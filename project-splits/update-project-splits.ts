import { Contract, ethers } from 'ethers'
import RepoDriver from './abis/RepoDriver.json'
import Caller from './abis/Caller.json'
import gitHubRepos from '../src/github-contributors/github-repos.json'
import fs from 'fs'
import updateLogData from './update_log.json'
interface LogEntry {
    repo: string
    timestamp: number
    txHash: string
}
const update_log = updateLogData as LogEntry[]

require("dotenv").config()

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
        if (repo != "webapp-lfs") {
            // TODO: remove
            continue
        }
        console.log()
        console.log('repo:', repo)

        // Get the Drips account ID of the GitHub repo
        const repoName = "elimu-ai/" + repo
        console.log('repoName:', repoName)
        const repoNameAsHex: string = String(ethers.hexlify(ethers.toUtf8Bytes(repoName)))
        console.log('repoNameAsHex:', repoNameAsHex)
        const repoAccountId: number = await repoDriverContract.calcAccountId(0, repoNameAsHex)
        console.log('repoAccountId:', repoAccountId)

        // Get CSV file with funding splits  
        const fundingsSplitsCsv: string = `../${repos[repo]}/github_${repo}/FUNDING_SPLITS.csv`
        console.log('fundingsSplitsCsv:', fundingsSplitsCsv)

        // Convert splits from CSV to JSON
        const splitsJsonArray = convertCsvToJson(fundingsSplitsCsv)
        console.log('splitsJson:', splitsJsonArray)

        // Prepare metadata JSON
        // TODO

        // Pin metadata JSON to IPFS
        // TODO

        // Cancel the on-chain update if the IPFS hash has not changed
        // TODO

        // Prepare metadata call data
        const metadata = [
            repoAccountId,
            [
                {
                    key: ethers.id("ipfs"),
                    value: ethers.AbiCoder.defaultAbiCoder().encode(
                        ["string"],
                        ["QmQFkZtcqsSodpkJLz4fNGdV5mNChZRLhjjjmZiBe98TJT"]
                    )
                }
            ]
        ]
        console.log('metadata:', metadata)

        // Prepare splits call data
        const splits = [
            repoAccountId,
            splitsJsonArray
        ]
        console.log('splits:', splits)

        // Before encoding, store a backup of the plaintext data
        fs.writeFileSync(
            `splits_${repo}.json`,
            JSON.stringify(splits, (key, value) => 
                (typeof value == 'bigint') ? value.toString() : value
            , 2)
        )

        // Encode call data
        const metadataEncoded = repoDriverContract.interface.encodeFunctionData('emitAccountMetadata', metadata)
        const splitsEncoded = repoDriverContract.interface.encodeFunctionData('setSplits', splits)

        // Prepare batched calls
        const batchedCalls = [
            [repoDriverContract.target, metadataEncoded, 0],
            [repoDriverContract.target, splitsEncoded, 0 ]
        ]
        console.log('batchedCalls:', batchedCalls)

        // Prepare signer account
        // TODO: handle separate private keys for different repos (content/engineering/distribution)
        const privateKey = process.env.PRIVATE_KEY
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
        console.log('feeData:', feeData)
        const gasPriceInWei: number = Number(feeData.gasPrice)
        console.log('gasPriceInWei:', gasPriceInWei)
        const gasPriceInGwei: number = Number(ethers.formatUnits(gasPriceInWei, 'gwei'))
        console.log('gasPriceInGwei:', gasPriceInGwei)

        // Cancel the on-chain update if gas price is too high
        const existingIndex = update_log.findIndex(entry => entry.repo === repo)
        if (existingIndex !== -1) {
            // Lookup the timestamp of the last time the splits were updated on-chain
            const timestampOfLastUpdate = update_log[existingIndex].timestamp
            console.log('timestampOfLastUpdate:', timestampOfLastUpdate)
            const timeOfLastUpdate = new Date(timestampOfLastUpdate * 1000)
            console.log('timeOfLastUpdate:', timeOfLastUpdate.toISOString())
            const daysSinceLastUpdate = (new Date().getTime() - timeOfLastUpdate.getTime()) / (1000 * 60 * 60 * 24)
            console.log('daysSinceLastUpdate:', daysSinceLastUpdate)
            if (daysSinceLastUpdate <= 7) {
                console.warn('Splits already updated with the past 7 days, skipping update for repo:', repo)
                continue
            } else if (
                (daysSinceLastUpdate >  7) && (gasPriceInGwei >= 0.01) ||
                (daysSinceLastUpdate > 14) && (gasPriceInGwei >= 0.02) ||
                (daysSinceLastUpdate > 21) && (gasPriceInGwei >= 0.03) ||
                (daysSinceLastUpdate > 28) && (gasPriceInGwei >= 0.04)
            ) {
                console.warn('Gas price too high, skipping update for repo:', repo)
                continue
            }
        } else {
            // First-time update, be more aggressive about gas price limits
            if (gasPriceInGwei >= 0.04) {
                console.warn('Gas price too high, skipping update for repo:', repo)
                continue
            }
        }

        // Set splits on-chain
        const tx = await callerContract.callBatched(batchedCalls, { gasPrice: gasPriceInWei })
        console.log('Transaction submitted. Hash:', tx.hash)
        const receipt = await tx.wait()
        console.log('Transaction confirmed. Receipt:', receipt)

        // Store the timestamp of the confirmed transaction in a log file
        const block = await provider.getBlock(receipt.blockNumber)
        const timestamp = block!.timestamp
        console.log('Transaction timestamp:', timestamp)
        if (existingIndex !== -1) {
            update_log[existingIndex] = { repo, timestamp, txHash: tx.hash }
        } else {
            update_log.push({ repo, timestamp, txHash: tx.hash })
        }
        console.log('update_log:', update_log)
        fs.writeFileSync(
            'update_log.json',
            JSON.stringify(update_log, null, 2)
        )
    }
}

interface SplitReceiver {
    accountId: string;
    weight: number;
}
function convertCsvToJson(csvFilePath: string): SplitReceiver[] {
    console.log('convertCsvToJson');

    // Read and parse CSV
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.trim().split('\n').slice(1); // Skip header
    
    const splits = lines.map(line => {
        const [address, percentage] = line.split(',');
        
        // Convert address to account ID (just the numeric value of the address)
        const accountId = BigInt(address.trim()).toString();
        
        // Convert percentage to weight (percentage * 10000)
        const weight = Math.round(parseFloat(percentage.trim()) * 10000);
        
        return { accountId, weight };
    });
    
    // Validate total
    const total = splits.reduce((sum, s) => sum + s.weight, 0);
    console.log(`Total weight: ${total}`);
    if (total != 1_000_000) {
        throw new Error(`Total weight is ${total} (expected 1,000,000)`);
    }
    
    return splits;
}
