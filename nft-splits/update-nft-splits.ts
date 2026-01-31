import { Contract, ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const NFTDriver = JSON.parse(fs.readFileSync(path.join(__dirname, './abis/NFTDriver.json'), 'utf-8'))
const Caller = JSON.parse(fs.readFileSync(path.join(__dirname, './abis/Caller.json'), 'utf-8'))
const dripListJson = JSON.parse(fs.readFileSync(path.join(__dirname, './drip-lists.json'), 'utf-8'))
const updateLogData = JSON.parse(fs.readFileSync(path.join(__dirname, './update_log.json'), 'utf-8'))
interface LogEntry {
    dripListKey: string
    ipfsHash: string
    timestamp: number
    txHash: string
}
const update_log = updateLogData as LogEntry[]

dotenv.config({ quiet: true })

const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com')

const nftDriverContract: Contract = new ethers.Contract(
    '0xcf9c49B0962EDb01Cdaa5326299ba85D72405258', // https://github.com/drips-network/contracts/blob/main/deployments/ethereum.json
    NFTDriver.abi,
    provider
)

updateNFTSplits()

async function updateNFTSplits() {
    // console.log('updateNFTSplits')

    const dripLists: any = dripListJson
    for (const dripListKey in dripLists) {
        // console.log()
        // console.log('dripListKey:', dripListKey)

        const dripList = dripLists[dripListKey]
        // console.log('dripList:', dripList)

        // Get CSV file with funding splits  
        const fundingsSplitsCsv: string = `../funding-splits-${dripList.category.toLowerCase()}/lang-${dripList.languageCode}/FUNDING_SPLITS.csv`
        // console.log('fundingsSplitsCsv:', fundingsSplitsCsv)

        // Convert splits from CSV to JSON
        const splitsJsonArray = convertCsvToJson(fundingsSplitsCsv)
        // console.log('splitsJsonArray:', splitsJsonArray)

        // Prepare metadata JSON
        const metadataJson = generateMetadataJson(dripList, splitsJsonArray)
        // console.log('metadataJson:', metadataJson)

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
                    name: `metadata_${dripListKey}.json`
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
        const existingDripListEntry = update_log.find(entry => entry.dripListKey === dripListKey)
        // console.log('existingDripListEntry:', existingDripListEntry)
        if (existingDripListEntry?.ipfsHash === ipfsHash) {
            // console.warn('IPFS hash unchanged, skipping update for drip list:', dripListKey)
            continue
        }

        // Prepare splits call data
        const splits = [
            dripList.tokenId,
            splitsJsonArray
        ]
        // console.log('splits:', splits)

        // Prepare metadata call data
        const metadata = [
            dripList.tokenId,
            [
                {
                    key: ethers.encodeBytes32String("ipfs"),
                    value: ethers.hexlify(ethers.toUtf8Bytes(ipfsHash))
                }
            ]
        ]
        // console.log('metadata:', metadata)

        // Encode call data
        const splitsEncoded = nftDriverContract.interface.encodeFunctionData('setSplits', splits)
        const metadataEncoded = nftDriverContract.interface.encodeFunctionData('emitAccountMetadata', metadata)

        // Prepare batched calls
        const batchedCalls = [
            [nftDriverContract.target, splitsEncoded, 0 ],
            [nftDriverContract.target, metadataEncoded, 0]
        ]
        // console.log('batchedCalls:', batchedCalls)

        // Prepare signer account
        const privateKey = process.env[`PRIVATE_KEY_${dripList.category}`]
        if (!privateKey) {
            throw new Error('PRIVATE_KEY not set in environment variables')
        }
        // console.log('privateKey length:', privateKey.length)
        const wallet = new ethers.Wallet(privateKey)
        const signer = wallet.connect(provider)
        // console.log('signer address:', signer.address)
        // console.log('signer balance (ETH):', ethers.formatEther(await provider.getBalance(signer.address)))
        const callerContract: Contract = new ethers.Contract(
            '0x60F25ac5F289Dc7F640f948521d486C964A248e5', // https://github.com/drips-network/contracts/blob/main/deployments/ethereum.json
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
        const existingIndex = update_log.findIndex(entry => entry.dripListKey === dripListKey)
        if (existingIndex == -1) {
            // Initial update
            if (gasPriceInGwei >= 0.04) {
                // console.warn('Gas price too high, skipping update for drip list:', dripListKey)
                continue
            }
        } else {
            // Lookup the timestamp of the last time the splits were updated on-chain
            const timestampOfLastUpdate = update_log[existingIndex].timestamp
            // console.log('timestampOfLastUpdate:', timestampOfLastUpdate)
            const timeOfLastUpdate = new Date(timestampOfLastUpdate * 1000)
            // console.log('timeOfLastUpdate:', timeOfLastUpdate.toISOString())
            const daysSinceLastUpdate = (new Date().getTime() - timeOfLastUpdate.getTime()) / (1000 * 60 * 60 * 24)
            // console.log('daysSinceLastUpdate:', daysSinceLastUpdate)
            if (daysSinceLastUpdate <= 7) {
                // console.warn('Splits already updated within the past 7 days, skipping update for drip list:', dripListKey)
                continue
            } else if (
                (daysSinceLastUpdate > 28) && (gasPriceInGwei >= 0.04) ||
                (daysSinceLastUpdate > 21) && (gasPriceInGwei >= 0.03) ||
                (daysSinceLastUpdate > 14) && (gasPriceInGwei >= 0.02) ||
                (daysSinceLastUpdate >  7) && (gasPriceInGwei >= 0.01)
            ) {
                // console.warn('Gas price too high, skipping update for drip list:', dripListKey)
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
            update_log[existingIndex] = { dripListKey, ipfsHash, timestamp, txHash: tx.hash }
        } else {
            update_log.push({ dripListKey, ipfsHash, timestamp, txHash: tx.hash })
        }
        // console.log('update_log:', update_log)
        fs.writeFileSync(
            'update_log.json',
            JSON.stringify(update_log, null, 2)
        )

        // Store a backup of the plaintext metadata
        fs.writeFileSync(
            `metadata_${dripListKey}.json`,
            JSON.stringify(metadataJson, null, 2)
        )

        // Print the drip list key for the workflow's Git commit message
        console.log(dripListKey)

        // Only process one drip list at a time (to enable one Git commit per drip list update)
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

function generateMetadataJson(dripList: any, splits: SplitReceiver[]) {
    // console.log('generateMetadataJson')

    // Add "type" fields to each split receiver
    const splitsWithDetails = splits.map(receiver => ({
        type: "address",
        ...receiver
    }))
    // console.log('splitsWithDetails:', splitsWithDetails)

    return {
        driver: "nft",
        type: "dripList",
        describes: {
            accountId: dripList.tokenId,
            driver: "nft"
        },
        name: dripList.name,
        description: dripList.description,
        isVisible: true,
        recipients: splitsWithDetails
    }
}
