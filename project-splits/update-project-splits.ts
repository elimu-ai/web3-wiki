import { Contract, ethers } from 'ethers'
import RepoDriver from './abis/RepoDriver.json'
import Caller from './abis/Caller.json'
import gitHubRepos from '../src/github-contributors/github-repos.json'
import fs from 'fs'
import updateLogData from './update_log.json'
interface LogEntry {
    repo: string
    ipfsHash: string
    timestamp: number
    txHash: string
}
const update_log = updateLogData as LogEntry[]

require("dotenv").config({ debug: false })

const provider = new ethers.JsonRpcProvider('https://0xrpc.io/eth')

const repoDriverContract: Contract = new ethers.Contract(
    '0x770023d55D09A9C110694827F1a6B32D5c2b373E',
    RepoDriver.abi,
    provider
)

updateProjectSplits()

async function updateProjectSplits() {
    console.log('updateProjectSplits')

    const repos: any = gitHubRepos
    for (const repo in repos) {
        // console.log()
        // console.log('repo:', repo)

        // Extract repo category from path (e.g. "funding-splits-content" -> "CONTENT")
        const repoCategory = repos[repo].substring(15).toUpperCase()
        // console.log('repoCategory:', repoCategory)

        // Get the Drips account ID of the GitHub repo
        const repoName = "elimu-ai/" + repo
        // console.log('repoName:', repoName)
        const repoNameAsHex: string = String(ethers.hexlify(ethers.toUtf8Bytes(repoName)))
        // console.log('repoNameAsHex:', repoNameAsHex)
        const repoAccountId: number = await repoDriverContract.calcAccountId(0, repoNameAsHex)
        // console.log('repoAccountId:', repoAccountId)

        // Get CSV file with funding splits  
        const fundingsSplitsCsv: string = `../${repos[repo]}/github_${repo}/FUNDING_SPLITS.csv`
        // console.log('fundingsSplitsCsv:', fundingsSplitsCsv)

        // Convert splits from CSV to JSON
        const splitsJsonArray = convertCsvToJson(fundingsSplitsCsv)
        // console.log('splitsJsonArray:', splitsJsonArray)

        // Prepare metadata JSON
        const metadataJson = generateMetadataJson(repo, repoAccountId.toString(), splitsJsonArray, repoCategory)
        // console.log('metadataJson:', metadataJson)
        // console.log('metadataJson (stringified):', JSON.stringify(metadataJson, null, 2))

        // Before encoding, store a backup of the plaintext metadata
        fs.writeFileSync(
            `metadata_${repo}.json`,
            JSON.stringify(metadataJson, null, 2)
        )

        // Pin metadata JSON to IPFS
        const jwt = process.env.PINATA_JWT
        if (!jwt) {
            throw new Error('PINATA_JWT not set in environment variables')
        }
        // console.log('jwt length:', jwt.length)
        const url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
        const pinRequest = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${jwt}`
            },
            body: JSON.stringify({
                pinataContent: metadataJson,
                pinataMetadata: {
                    name: `metadata_${repo}.json`
                },
                pinataOptions: {
                    cidVersion: 0
                }
            })
        })
        const pinResponse = await pinRequest.json()
        // console.log('pinResponse:', pinResponse)
        const ipfsHash = pinResponse.IpfsHash
        // console.log('ipfsHash:', ipfsHash)

        // Cancel the on-chain update if the IPFS hash has not changed
        const existingRepoEntry = update_log.find(entry => entry.repo === repo)
        // console.log('existingRepoEntry:', existingRepoEntry)
        if (existingRepoEntry?.ipfsHash === ipfsHash) {
            console.warn('IPFS hash unchanged, skipping update for repo:', repo)
            continue
        }

        // Prepare metadata call data
        const metadata = [
            repoAccountId,
            [
                {
                    key: ethers.encodeBytes32String("ipfs"),
                    value: ethers.hexlify(ethers.toUtf8Bytes(ipfsHash))
                }
            ]
        ]
        // console.log('metadata:', metadata)

        // Prepare splits call data
        const splits = [
            repoAccountId,
            splitsJsonArray
        ]
        // console.log('splits:', splits)

        // Encode call data
        const metadataEncoded = repoDriverContract.interface.encodeFunctionData('emitAccountMetadata', metadata)
        const splitsEncoded = repoDriverContract.interface.encodeFunctionData('setSplits', splits)

        // Prepare batched calls
        const batchedCalls = [
            [repoDriverContract.target, splitsEncoded, 0 ],
            [repoDriverContract.target, metadataEncoded, 0]
        ]
        console.log('batchedCalls:', batchedCalls)

        // Prepare signer account
        const privateKey = process.env[`PRIVATE_KEY_${repoCategory}`]
        if (!privateKey) {
            throw new Error('PRIVATE_KEY not set in environment variables')
        }
        console.log('privateKey length:', privateKey.length)
        const wallet = new ethers.Wallet(privateKey)
        const signer = wallet.connect(provider)
        console.log('signer address:', signer.address)
        console.log('signer balance (ETH):', ethers.formatEther(await provider.getBalance(signer.address)))
        const callerContract: Contract = new ethers.Contract(
            '0x60F25ac5F289Dc7F640f948521d486C964A248e5',
            Caller.abi,
            signer
        )

        // Get the current gas price
        const feeData = await provider.getFeeData()
        // console.log('feeData:', feeData)
        const gasPriceInWei: number = Number(feeData.gasPrice)
        // console.log('gasPriceInWei:', gasPriceInWei)
        const gasPriceInGwei: number = Number(ethers.formatUnits(gasPriceInWei, 'gwei'))
        // console.log('gasPriceInGwei:', gasPriceInGwei)

        // Cancel the on-chain update if gas price is too high
        const existingIndex = update_log.findIndex(entry => entry.repo === repo)
        if (existingIndex !== -1) {
            // Lookup the timestamp of the last time the splits were updated on-chain
            const timestampOfLastUpdate = update_log[existingIndex].timestamp
            // console.log('timestampOfLastUpdate:', timestampOfLastUpdate)
            const timeOfLastUpdate = new Date(timestampOfLastUpdate * 1000)
            // console.log('timeOfLastUpdate:', timeOfLastUpdate.toISOString())
            const daysSinceLastUpdate = (new Date().getTime() - timeOfLastUpdate.getTime()) / (1000 * 60 * 60 * 24)
            // console.log('daysSinceLastUpdate:', daysSinceLastUpdate)
            if (daysSinceLastUpdate <= 7) {
                console.warn('Splits already updated within the past 7 days, skipping update for repo:', repo)
                continue
            } else if (
                (daysSinceLastUpdate > 28) && (gasPriceInGwei >= 0.04) ||
                (daysSinceLastUpdate > 21) && (gasPriceInGwei >= 0.03) ||
                (daysSinceLastUpdate > 14) && (gasPriceInGwei >= 0.02) ||
                (daysSinceLastUpdate >  7) && (gasPriceInGwei >= 0.01)
            ) {
                console.warn('Gas price too high, skipping update for repo:', repo)
                continue
            }
        } else {
            // Initial update, be more aggressive about gas price limits
            if (gasPriceInGwei >= 0.04) {
                console.warn('Gas price too high, skipping update for repo:', repo)
                continue
            }
        }

        // Set splits on-chain
        const tx = await callerContract.callBatched(batchedCalls)
        // console.log('Transaction submitted. Hash:', tx.hash)
        const receipt = await tx.wait()
        // console.log('Transaction confirmed. Receipt:', receipt)

        // Store the timestamp of the confirmed transaction in a log file
        const block = await provider.getBlock(receipt.blockNumber)
        const timestamp = block!.timestamp
        // console.log('Transaction timestamp:', timestamp)
        if (existingIndex !== -1) {
            update_log[existingIndex] = { repo, ipfsHash, timestamp, txHash: tx.hash }
        } else {
            update_log.push({ repo, ipfsHash, timestamp, txHash: tx.hash })
        }
        // console.log('update_log:', update_log)
        fs.writeFileSync(
            'update_log.json',
            JSON.stringify(update_log, null, 2)
        )

        // Print the repo name for the workflow's Git commit message
        console.log(`@elimu-ai/${repo}`)

        // Only process one repo at a time (to enable one Git commit per repo update)
        return
    }
}

interface SplitReceiver {
    accountId: string;
    weight: number;
}
function convertCsvToJson(csvFilePath: string): SplitReceiver[] {
    // console.log('convertCsvToJson');

    // Read and parse CSV
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.trim().split('\n').slice(1); // Skip header
    
    const splits = lines.map(line => {
        const [address, percentage] = line.split(',');

        // Convert percentage to weight (percentage * 10000)
        const weight = Math.round(parseFloat(percentage.trim()) * 10000);
        
        // Convert address to account ID (just the numeric value of the address)
        const accountId = BigInt(address.trim()).toString();
        
        return { weight, accountId, address: address.trim().toLowerCase() };
    })
    .sort((a, b) => a.address.localeCompare(b.address)) // Sort by Ethereum address (case-insensitive)
    // console.log('Parsed splits:', splits);

    // Merge duplicate addresses by summing their weights
    const mergedSplits: SplitReceiver[] = [];
    const accountIdMap = new Map<string, number>();
    for (const split of splits) {
        const existingWeight = accountIdMap.get(split.accountId) || 0;
        accountIdMap.set(split.accountId, existingWeight + split.weight);
    }
    for (const [accountId, weight] of accountIdMap.entries()) {
        mergedSplits.push({ weight, accountId });
    }
    // console.log('Merged splits:', mergedSplits);

    // Calculate total and adjust for rounding errors
    const total = mergedSplits.reduce((sum, s) => sum + s.weight, 0);
    // console.log(`Total weight before adjustment: ${total}`);
    if (total != 1_000_000) {
        // Find the entry with the largest weight and adjust it
        const difference = 1_000_000 - total;
        const largestEntry = mergedSplits.reduce((max, current) => 
            current.weight > max.weight ? current : max
        );
        
        // console.log(`Adjusting largest weight by ${difference} (from ${largestEntry.weight} to ${largestEntry.weight + difference})`);
        largestEntry.weight += difference;
        
        // Verify the adjustment
        const newTotal = mergedSplits.reduce((sum, s) => sum + s.weight, 0);
        // console.log(`Total weight after adjustment: ${newTotal}`);
        
        if (newTotal !== 1_000_000) {
            throw new Error(`Failed to adjust weights correctly. Total is ${newTotal} (expected 1,000,000)`);
        }
    }
    
    return mergedSplits;
}

function generateMetadataJson(repo: string, accountId: string, splits: SplitReceiver[], repoCategory: string) {
    // console.log('generateMetadataJson')

    // Add "sublist" and "type" fields to each split receiver
    const splitsWithDetails = splits.map(receiver => ({
        sublist: "maintainers",
        type: "address",
        ...receiver
    }))
    // console.log('splitsWithDetails:', splitsWithDetails)

    // Set different colors for different repo categories
    let color = "#5319E7" // Default color (CONTENT)
    let emoji = "🎶" // Default emoji (CONTENT)
    if (repoCategory === "ENGINEERING") {
        color = "#27C537"
        emoji = "👩🏽‍💻"
    } else if (repoCategory === "DISTRIBUTION") {
        color = "#1D76DB"
        emoji = "🛵"
    }

    return {
        driver: "repo",
        describes: {
            driver: "repo",
            accountId: accountId
        },
        source: {
            forge: "github",
            repoName: repo,
            ownerName: "elimu-ai",
            url: `https://github.com/elimu-ai/${repo}`
        },
        color: color,
        splits: {
            dependencies: [],
            maintainers: splitsWithDetails
        },
        avatar: {
            type: "emoji",
            emoji: emoji
        },
        isVisible: true
    }
}
