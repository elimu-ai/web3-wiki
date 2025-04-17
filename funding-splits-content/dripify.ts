import fs from 'node:fs'
import { parse } from 'csv-parse'
import { stringify } from 'csv-stringify'

const languages = ['ENG', 'HIN', 'TGL', 'THA', 'VIE']
console.log('languages:', languages)
for (const language of languages) {
    console.log()
    console.log('language:', language)

    const languageDir = `lang-${language}`
    console.log('languageDir:', languageDir)
    const filePath = `${languageDir}/contributors.csv`
    console.log('filePath:', filePath)
    const outputPath = `${languageDir}/FUNDING_SPLITS.csv`
    console.log('outputPath:', outputPath)

    const columns = [ 'id', 'ethereum_address', 'impact_percentage' ]
    const stringifier = stringify({ header: true, columns: [ 'ethereum_address', 'impact_percentage' ] })
    const writeStream = fs.createWriteStream(outputPath)
    let impactPercentageZeroAddress = 0
    fs.createReadStream(filePath)
        .pipe(parse({ from_line: 2 }))
        .on('data', (row) => {
            console.log('row:', row)
            const ethereumAddress = row[columns.indexOf('ethereum_address')]
            const impactPercentage = Number(row[columns.indexOf('impact_percentage')])
            if (impactPercentage > 0) {
                if (ethereumAddress == '0x0000000000000000000000000000000000000000') {
                    impactPercentageZeroAddress += impactPercentage
                    return
                }
                const row_dripified = [ ethereumAddress, impactPercentage ]
                console.log('row_dripified:', row_dripified)
                stringifier.write(row_dripified)
            }
        })
        .on('end', () => {
            console.log('end:', filePath)
            if (impactPercentageZeroAddress > 0) {
                const row_dripified = [ '0x0000000000000000000000000000000000000000', impactPercentageZeroAddress ]
                stringifier.write(row_dripified)
            }
            stringifier.pipe(writeStream)
            console.log('Finished writing data:', filePath)
        })
}
