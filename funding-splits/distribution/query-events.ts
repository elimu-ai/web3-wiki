import { Contract, ethers, EventLog, JsonRpcProvider, Log, Result } from 'ethers'
import SponsorshipQueue from './abis/SponsorshipQueue.json'
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer'

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

query()

async function query() {
    console.log('query')
    
    const events = await sponsorshipQueueContract.queryFilter('*')
    console.log('events.length:', events.length)

    const eventData: any[] = []

    events.forEach((eventLog: any) => {
        console.log('')
        // console.log('eventLog:', eventLog)
        
        const blockNumber: number = eventLog.blockNumber
        console.log('blockNumber:', eventLog.blockNumber)

        const eventName: string = eventLog.fragment.name
        console.log('eventName:', eventName)

        const argResult: Result = eventLog.args
        // console.log('argResult:', argResult)
        //
        // Sample:
        // 
        // Result(1) [
        //     Result(3) [
        //         2000000000000000n,
        //         1721578316n,
        //         '0x015B5dF1673499E32D11Cf786A43D1c42b3d725C'
        //     ]
        // ]

        if (eventName == 'SponsorshipAdded') {
            const argResultArray: Result = argResult[0]
            // console.log('argResultArray:', argResultArray)

            const estimatedCost: number = argResultArray[0]
            console.log('estimatedCost:', estimatedCost)

            const timestamp: number = argResultArray[1]
            console.log('timestamp:', timestamp)

            const sponsorAddress: string = argResultArray[2]
            console.log('sponsorAddress:', sponsorAddress)

            eventData.push([estimatedCost, timestamp, sponsorAddress])
        }
    })

    prepareCsvData(eventData)
}

async function prepareCsvData(eventData: any[]) {
    console.log('prepareCsvData')

    console.log('eventData.length:', eventData.length)

    // Count events per sponsor address
    const csvData: any[] = []
    // Sample:
    //
    // [
    //   {
    //     ethereum_address: '0x015B5dF1673499E32D11Cf786A43D1c42b3d725C'
    //     sponsorship_count: 1
    //     distribution_count: 0
    //     impact_percentage: 100
    //   }
    // ]
    eventData.forEach(sponsorshipEvent => {
        const estimatedCost: number = sponsorshipEvent[0]
        const timestamp: number = sponsorshipEvent[1]
        const sponsorAddress: string = sponsorshipEvent[2]

        // Check if data already exists for the sponsor address
        let existingData: any = undefined
        csvData.forEach(data => {
            // console.log('data:', data)
            if (sponsorAddress == data.ethereum_address) {
                existingData = data
            }
        })

        if (!existingData) {
            console.log('Add data for address:', sponsorAddress)

            const newData = {
                ethereum_address: sponsorAddress,
                sponsorship_count: 1,
                distribution_count: 0
            }
            csvData.push(newData)
        } else {
            console.log('Update data for address:', sponsorAddress)
            
            existingData.sponsorship_count++
        }
    })
    console.log('csvData:', csvData)

    calculateImpactPercentages(csvData)

    exportToCsv(csvData)
}

function calculateImpactPercentages(csvData: any[]) {
    console.log('calculateImpactPercentages')

    let sponsorshipCountTotal: number = 0
    let distributionCountTotal: number = 0
    csvData.forEach(csvDataRow => {
        sponsorshipCountTotal += csvDataRow.sponsorship_count
        distributionCountTotal += csvDataRow.distribution_count
    })
    console.log('sponsorshipCountTotal:', sponsorshipCountTotal)
    console.log('distributionCountTotal:', distributionCountTotal)

    // Calculate the impact percentage for each sponsor address
    csvData.forEach(csvDataRow => {
        const impactPercentage: number = 100
                                         * (csvDataRow.sponsorship_count + csvDataRow.distribution_count) 
                                         / (sponsorshipCountTotal + distributionCountTotal)
        // console.log('impactPercentage:', impactPercentage)
        csvDataRow.impact_percentage = impactPercentage
    })
    console.log('csvData:', csvData)
}

function exportToCsv(csvData: any[]) {
    console.log('exportToCsv')

    const outputPath: string = 'FUNDING_SPLITS_HIN.csv'
    console.log('outputPath:', outputPath)
    const csvWriter = createCsvWriter({
        path: outputPath,
        header: [
            {id: 'ethereum_address', title: 'ethereum_address'},
            {id: 'sponsorship_count', title: 'sponsorship_count'},
            {id: 'distribution_count', title: 'distribution_count'},
            {id: 'impact_percentage', title: 'impact_percentage'}
        ]
    })

    csvWriter
        .writeRecords(csvData)
        .then(() => {
            console.log('The CSV file was written successfully:', outputPath)
        })
}
