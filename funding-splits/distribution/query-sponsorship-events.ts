import { Contract, ethers, EventLog, JsonRpcProvider, Log } from 'ethers'
import SponsorshipQueue from './abis/SponsorshipQueue.json'

const rpcServerAddress: string = 'https://base-sepolia.blockpi.network/v1/rpc/public'
console.log('rpcServerAddress:', rpcServerAddress)

const provider: JsonRpcProvider = new ethers.JsonRpcProvider(rpcServerAddress)
// console.log('provider:', provider)

const sponsorshipQueueContract: Contract = new ethers.Contract(
    '0x9Af2E73663968fdfb9791b7D6Bd40cd259f0388a',
    SponsorshipQueue.abi,
    provider
)
// console.log('sponsorshipQueueContract:', sponsorshipQueueContract)

async function query() {
    console.log('query')
    
    const events = await sponsorshipQueueContract.queryFilter('*')
    console.log('events.length:', events.length)

    events.forEach((eventLog: any) => {
        console.log('\n')
        console.log('eventLog.blockNumber:', eventLog.blockNumber)
        console.log('eventLog.fragment.name:', eventLog.fragment.name)
        console.log('eventLog.args:', eventLog.args)
    })
}

query()
