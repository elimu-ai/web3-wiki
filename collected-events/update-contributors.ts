import fs from 'node:fs'
import { parse } from 'csv-parse'
import { Contract, ethers } from 'ethers'
import Contributors from './abis/Contributors.json'
import dotenv from 'dotenv'

dotenv.config()

updateContributors()

async function updateContributors() {
    console.log('updateContributors')

    const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com')

    // Prepare signer account
    const privateKey = process.env['PRIVATE_KEY_CONTRIBUTORS']
    if (!privateKey) {
        throw new Error('PRIVATE_KEY_CONTRIBUTORS not set in environment variables')
    }
    console.log('privateKey length:', privateKey.length)
    const wallet = new ethers.Wallet(privateKey)
    const signer = wallet.connect(provider)
    console.log('signer address:', signer.address)
    console.log('signer balance (ETH):', ethers.formatEther(await provider.getBalance(signer.address)))

    /**
     * https://etherscan.io/address/0x091d2bcfdCBeb534209600304a9949D5663eDe3E#code
     */
    const contributorsContract: Contract = new ethers.Contract(
        '0x091d2bcfdCBeb534209600304a9949D5663eDe3E',
        Contributors.abi,
        signer
    )

    const columns = [ 'ethereum_address', 'collected_sum' ]
    const parser = fs
        .createReadStream('collected-events.csv')
        .pipe(parse({ from_line: 2 }))
    for await (const row of parser) {
        console.log('\n')
        console.log('row:', row)

        const ethereumAddress = row[columns.indexOf('ethereum_address')]
        const collectedSum = Number(row[columns.indexOf('collected_sum')])

        if (collectedSum >= 387_000) {
            const collectedSumInWei = ethers.parseUnits(collectedSum.toString(), 18)
            console.log('collectedSumInWei:', collectedSumInWei)

            console.log('Fetching last updated amount on-chain...')
            const lastUpdatedAmountInWei = await contributorsContract.collectedViaDrips(ethereumAddress)
            console.log('lastUpdatedAmountInWei:', lastUpdatedAmountInWei)

            if (collectedSumInWei > lastUpdatedAmountInWei) {
                console.log(`Updating amount for ${ethereumAddress} from ${lastUpdatedAmountInWei} to ${collectedSumInWei}...`)

                // Get the current gas price
                const feeData = await provider.getFeeData()
                console.log('feeData:', feeData)
                const gasPriceInWei: number = Number(feeData.gasPrice)
                console.log('gasPriceInWei:', gasPriceInWei)
                const gasPriceInGwei: number = Number(ethers.formatUnits(gasPriceInWei, 'gwei'))
                console.log('gasPriceInGwei:', gasPriceInGwei)
                if (gasPriceInGwei >= 0.08) {
                    console.warn('Gas price too high, skipping update.')
                    return
                }

                // Update amount on-chain
                const tx = await contributorsContract.updateAmount(ethereumAddress, collectedSumInWei)
                console.log('Transaction submitted. Hash:', tx.hash)
                const receipt = await tx.wait()
                console.log('Transaction confirmed. Receipt:', receipt)
            } else {
                console.log(`No update needed for ${ethereumAddress}`)
            }
        }
    }
}
