import fs from 'node:fs'
import http from 'http'

const languages = ['ENG', 'HIN', 'TGL']
console.log('languages:', languages)
for (const language of languages) {
    console.log()
    console.log('language:', language)

    const downloadUrl = `http://${language.toLowerCase()}.elimu.ai/contributor/list/contributors.csv`
    console.log('downloadUrl:', downloadUrl)

    const languageDir = `lang-${language}`
    console.log('languageDir:', languageDir)
    if (!fs.existsSync(languageDir)) {
        fs.mkdirSync(languageDir)
    }
    const filePath = `${languageDir}/contributors.csv`
    console.log('filePath:', filePath)
    
    const file = fs.createWriteStream(filePath)
    http.get(downloadUrl, (response) => {
        response.pipe(file)
        file.on('finish', () => {
            file.close(() => {
                console.log('File downloaded successfully:', file.path)
            })
        })
    })
}
