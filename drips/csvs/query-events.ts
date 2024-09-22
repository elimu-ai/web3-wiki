import { Contract, ethers, getDefaultProvider, Result } from 'ethers'
import Drips from './abis/Drips.json'
import fs from 'node:fs'

const provider = getDefaultProvider()

/**
 * https://etherscan.io/address/0xd0dd053392db676d57317cd4fe96fc2ccf42d0b4#code
 */
const dripsContract: Contract = new ethers.Contract(
    '0xd0Dd053392db676D57317CD4fe96Fc2cCf42D0b4',
    Drips.abi,
    provider
)

query()

async function query() {
    console.log('query')

    const splitsSetEvents = await dripsContract.queryFilter(
        'SplitsSet',
        18533142 // https://etherscan.io/tx/0xa5d7aec9edd4874221d0e984912d967d8cd96b297a0fc23b1d8265a03230f90e
    )
    console.log('splitsSetEvents.length:', splitsSetEvents.length)

    const splitsReceiverSeenEvents = await dripsContract.queryFilter(
        'SplitsReceiverSeen',
        18533142 // https://etherscan.io/tx/0xa5d7aec9edd4874221d0e984912d967d8cd96b297a0fc23b1d8265a03230f90e
    )
    console.log('splitsReceiverSeenEvents.length:', splitsReceiverSeenEvents.length)

    const repos = [
        // content.elimu.eth
        'crowdsource',
        'webapp',

        // engineering.elimu.eth
        'content-provider',
        'keyboard',
        'kukariri',
        'ml-event-simulator',
        'ml-storybook-reading-level',
        'ml-storybook-recommender',
        'model',

        // reading.engineering.elimu.eth
        'VoltAir',
        'familiar-word-reading',
        'herufi',
        'image-picker',
        'silabi',
        'sound-cards',
        'storybooks',
        'visemes',
        'vitabu',
        'walezi-android',

        // writing.engineering.elimu.eth
        'chat',
        'handwriting-letters',
        'handwriting-numbers',

        // math.engineering.elimu.eth
        'CameraColorPicker',
        'android_packages_apps_Calculator',
        'missing-number',
        'nambari',
        'nyas-space-quest',
        'nyas-space-quest-qd',
        'shapi',
        'soga',
        'tilt-game',

        // distribution.elimu.eth
        'analytics',
        'appstore',
        'launcher',
        'ml-authentication',
        'start-guide',
        'website',
        'web3-sponsors',
    ]
    for (const repo of repos) {
        console.log()
        console.log('repo:', repo)
        const repoAsHex: string = String(ethers.hexlify(ethers.toUtf8Bytes(repo)))
        console.log('repoAsHex:', repoAsHex)
        const repoAsHexWithoutPrefix: string = repoAsHex.substring(2)
        console.log('repoAsHexWithoutPrefix:', repoAsHexWithoutPrefix)

        let ethereumAddresses: string[] = []
        for (const splitsSetEvent of splitsSetEvents) {
            const userId: string = String(splitsSetEvent['topics'][1])
            if (userId.indexOf(repoAsHexWithoutPrefix) > -1) {
                const receiversHash: string = String(splitsSetEvent['topics'][2])
                for (const splitsReceiverSeenEvent of splitsReceiverSeenEvents) {
                    const splitsReceiverSeenEventReceiverHash: string = String(splitsReceiverSeenEvent['topics'][1])
                    if (splitsReceiverSeenEventReceiverHash == receiversHash) {
                        const splitsReceiverSeenEventUserId: string = String(splitsReceiverSeenEvent['topics'][2])
                        if (ethereumAddresses.indexOf(splitsReceiverSeenEventUserId) == -1) {
                            ethereumAddresses.push(splitsReceiverSeenEventUserId)
                        }
                    }
                }
            }
        }
        console.log('ethereumAddresses:', ethereumAddresses)

        let splitsSetEventBlocks: number[] = []
        for (const splitsSetEvent of splitsSetEvents) {
            const userId: string = String(splitsSetEvent['topics'][1])
            if (userId.indexOf(repoAsHexWithoutPrefix) > -1) {
                const blockNumber: number = splitsSetEvent['blockNumber']
                splitsSetEventBlocks.push(blockNumber)
            }
        }
        console.log('splitsSetEventBlocks:', splitsSetEventBlocks)

        if (ethereumAddresses.length > 0) {
            let jsonData: any[] = []
            for (const ethereumAddress of ethereumAddresses) {
                let dataRow: any = {
                    ethereum_address: ethereumAddress
                }
                for (const blockNumber of splitsSetEventBlocks) {
                    dataRow[`splits_at_${blockNumber}`] = 0
                }

                for (const splitsSetEvent of splitsSetEvents) {
                    const userId: string = String(splitsSetEvent['topics'][1])
                    if (userId.indexOf(repoAsHexWithoutPrefix) > -1) {
                        const receiversHash: string = String(splitsSetEvent['topics'][2])
                        for (const splitsReceiverSeenEvent of splitsReceiverSeenEvents) {
                            const splitsReceiverSeenEventReceiverHash: string = String(splitsReceiverSeenEvent['topics'][1])
                            if (splitsReceiverSeenEventReceiverHash == receiversHash) {
                                const splitsReceiverSeenEventUserId: string = String(splitsReceiverSeenEvent['topics'][2])
                                if (splitsReceiverSeenEventUserId == ethereumAddress) {
                                    // console.log(ethereumAddress, splitsReceiverSeenEvent.blockNumber, Number(ethers.formatUnits(splitsReceiverSeenEvent['data'], 4)))
                                    dataRow[`splits_at_${splitsReceiverSeenEvent.blockNumber}`] = Number(ethers.formatUnits(splitsReceiverSeenEvent['data'], 4))
                                }
                            }
                        }
                    }
                }

                jsonData.push(dataRow)
            }
            exportToCSV(repo, jsonData)
        }
    }
}

function exportToCSV(repo: string, jsonData: any) {
    console.log('exportToCSV')

    const header = Object.keys(jsonData[0])
    console.log('header:', header)

    const csvData = [
        header.join(','),
        ...jsonData.map((row: any) => {
            return header.map(headerName => {
                return JSON.stringify(row[headerName])
            }).join(',')
        })
    ].join('\r\n')
    console.log('csvData:\n', csvData)

    const csvFile: string = `splits_${repo}.csv`
    console.log('csvFile:', csvFile)
    try {
        fs.writeFileSync(csvFile, csvData)
    } catch (err) {
        console.error(err)
    }
}
