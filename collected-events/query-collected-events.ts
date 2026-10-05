import { Contract, ethers } from 'ethers'
import Drips from './abis/Drips.json'
import fs from 'node:fs'

const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com/781114a270bebc37c808abf96189a8ac4149edca29ca5a8cc4dee291b6dedd8e') // Max 50k blocks per request

/**
 * https://etherscan.io/address/0xd0dd053392db676d57317cd4fe96fc2ccf42d0b4#code
 */
const dripsContract: Contract = new ethers.Contract(
    '0xd0Dd053392db676D57317CD4fe96Fc2cCf42D0b4',
    Drips.abi,
    provider
)
const START_BLOCK = 18_533_142 // https://etherscan.io/tx/0xa5d7aec9edd4874221d0e984912d967d8cd96b297a0fc23b1d8265a03230f90e

query()

/**
 * Query events in chunks to respect the 50k block limit
 */
async function queryEventsInChunks(contract: Contract, eventName: string): Promise<any[]> {
    const currentBlock = await provider.getBlockNumber()
    const chunkSize = 50_000
    let allEvents: any[] = []

    for (let fromBlock = START_BLOCK; fromBlock <= currentBlock; fromBlock += chunkSize) {
        const toBlock = (fromBlock + chunkSize) >= currentBlock 
            ? currentBlock 
            : fromBlock + chunkSize

        console.log(`Fetching ${eventName} events from block ${fromBlock} to ${toBlock}`)

        const events = await contract.queryFilter(eventName, fromBlock, toBlock)
        allEvents = [...allEvents, ...events]
        
        console.log(`Found ${events.length} events in this chunk. Total: ${allEvents.length}`)
    }

    return allEvents
}

async function query() {
    console.log('query')

    const collectedEvents = await queryEventsInChunks(dripsContract, 'Collected')
    console.log('collectedEvents.length:', collectedEvents.length)

    const sumPerAddressMap = new Map<string, number>();
    for (const collectedEvent of collectedEvents) {
        const erc20: string = collectedEvent.args[1]
        if (erc20 == '0xe29797910D413281d2821D5d9a989262c8121CC2') {
            const accountId: bigint = collectedEvent.args[0]
            const ethereumAddress = ethers.getAddress(ethers.zeroPadValue(ethers.toBeHex(accountId & ((BigInt(1) << BigInt(160)) - BigInt(1))), 20));
            
            const collected: bigint = collectedEvent.args[2]
            const collectedSum: number = (sumPerAddressMap.get(ethereumAddress) || 0) + Number(collected)
            
            sumPerAddressMap.set(ethereumAddress, collectedSum)
        }
    }
    console.log('sumPerAddressMap:', sumPerAddressMap)

    exportToCSV(sumPerAddressMap)
}

function exportToCSV(sumPerAddressMap: Map<string, number>) {
    console.log('exportToCSV')

    const header = ['ethereum_address', 'collected_sum']
    console.log('header:', header)

    const csvData = [
        header.join(','),
        ...Array.from(sumPerAddressMap.entries())
            .sort(([, a], [, b]) => b - a) // largest sums first
            .map(([address, sum]) => [JSON.stringify(address), sum / 10**18].join(',')),
    ].join('\r\n')
    console.log('csvData:\n', csvData)

    const csvFile: string = `collected-events.csv`
    console.log('csvFile:', csvFile)
    try {
        fs.writeFileSync(csvFile, csvData)
    } catch (err) {
        console.error(err)
    }
}
