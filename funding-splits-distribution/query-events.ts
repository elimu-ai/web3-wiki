import { Contract, ethers, JsonRpcProvider, Result } from 'ethers'
import SponsorshipQueue from './abis/SponsorshipQueue.json'
import DistributionQueue from './abis/DistributionQueue.json'
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer'

const rpcServerAddress: string = 'https://0xrpc.io/sep'
console.log('rpcServerAddress:', rpcServerAddress)

const chainId: number = 11155111
console.log('chainId:', chainId)

const provider: JsonRpcProvider = new ethers.JsonRpcProvider(rpcServerAddress, ethers.Network.from(chainId))

/**
 * Deployment details: https://github.com/elimu-ai/web3-sponsors/tree/main/backend/ignition/deployments
 */
const sponsorshipQueueContract: Contract = new ethers.Contract(
    '0xfc99678699eEcCB3c542Ad673801C8398450d038',
    SponsorshipQueue.abi,
    provider
)

/**
 * Deployment details: https://github.com/elimu-ai/web3-sponsors/tree/main/backend/ignition/deployments
 */
const distributionQueueContract: Contract = new ethers.Contract(
    '0xcCC411B4388B6C56e8DAF5e22666399c0E44D20a',
    DistributionQueue.abi,
    provider
)

query()

async function query() {
    console.log('query')
    
    const sponsorshipQueueEvents = await sponsorshipQueueContract.queryFilter('*')
    console.log('sponsorshipQueueEvents.length:', sponsorshipQueueEvents.length)
    const sponsorshipAddedEventData: any[] = []
    sponsorshipQueueEvents.forEach((eventLog: any) => {
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

            sponsorshipAddedEventData.push([estimatedCost, timestamp, sponsorAddress])
        }
    })

    const distributionQueueEvents = await distributionQueueContract.queryFilter('*')
    console.log('distributionQueueEvents.length:', distributionQueueEvents.length)
    const distributionAddedEventData: any[] = []
    distributionQueueEvents.forEach((eventLog: any) => {
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
        //   Result(4) [
        //     'TGL',
        //     'e387e38700000001',
        //     1764502536n,
        //     '0xA7D1CB88740642DC95774511Cc73f015396Be869'
        //   ]
        // ]

        if (eventName == 'DistributionAdded') {
            const argResultArray: Result = argResult[0]
            console.log('argResultArray:', argResultArray)

            const languageCode: string = argResultArray[0]
            console.log('languageCode:', languageCode)

            const androidId: string = argResultArray[1]
            console.log('androidId:', androidId)

            const timestamp: number = argResultArray[2]
            console.log('timestamp:', timestamp)

            const distributorAddress: string = argResultArray[3]
            console.log('distributorAddress:', distributorAddress)

            distributionAddedEventData.push([languageCode, timestamp, distributorAddress])
        }
    })

    prepareCsvData(sponsorshipAddedEventData, distributionAddedEventData)
}

/**
 * Prepare an array of JSON objects before exporting to CSV.
 * 
 * Sample:
 * 
 * {
 *   ethereum_address: '0x015B5dF1673499E32D11Cf786A43D1c42b3d725C',
 *   impact_percentage: 100,
 *   sponsorship_count: 1,
 *   distribution_count: 0
 * }
 */
async function prepareCsvData(sponsorshipAddedEvents: any[], distributionAddedEvents: any[]) {
    console.log('prepareCsvData')

    console.log('sponsorshipAddedEvents.length:', sponsorshipAddedEvents.length)
    console.log('distributionAddedEvents.length:', distributionAddedEvents.length)

    const csvData: any[] = []

    // Count 'SponsorshipAdded' events per sponsor address
    sponsorshipAddedEvents.forEach(sponsorshipAddedEvent => {
        const estimatedCost: number = sponsorshipAddedEvent[0]
        const timestamp: number = sponsorshipAddedEvent[1]
        const sponsorAddress: string = sponsorshipAddedEvent[2]

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

    // Count 'DistributionAdded' events per distributor address
    distributionAddedEvents.forEach(distributionAddedEvent => {
        const languageCode: string = distributionAddedEvent[0]
        const timestamp: number = distributionAddedEvent[1]
        const distributorAddress: string = distributionAddedEvent[2]

        // Check if data already exists for the distributor address
        let existingData: any = undefined
        csvData.forEach(data => {
            // console.log('data:', data)
            if (distributorAddress == data.ethereum_address) {
                existingData = data
            }
        })

        if (!existingData) {
            console.log('Add data for address:', distributorAddress)

            const newData = {
                ethereum_address: distributorAddress,
                sponsorship_count: 0,
                distribution_count: 1
            }
            csvData.push(newData)
        } else {
            console.log('Update data for address:', distributorAddress)
            
            existingData.distribution_count++
        }
    })

    console.log('csvData:', csvData)

    calculateImpactPercentages(csvData)

    exportToCsv(csvData, 'HIN')
    exportToCsv(csvData, 'TGL')
    exportToCsv(csvData, 'THA')
    exportToCsv(csvData, 'VIE')
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

function exportToCsv(csvData: any[], languageCode: string) {
    console.log('exportToCsv')

    const outputDir: string = `lang-${languageCode}`
    const outputPath: string = `${outputDir}/FUNDING_SPLITS.csv`
    console.log('outputPath:', outputPath)
    const csvWriter = createCsvWriter({
        path: outputPath,
        header: [
            {id: 'ethereum_address', title: 'ethereum_address'},
            {id: 'impact_percentage', title: 'impact_percentage'},
            {id: 'sponsorship_count', title: 'sponsorship_count'},
            {id: 'distribution_count', title: 'distribution_count'}
        ]
    })

    csvWriter
        .writeRecords(csvData)
        .then(() => {
            console.log('The CSV file was written successfully:', outputPath)
        })
}
