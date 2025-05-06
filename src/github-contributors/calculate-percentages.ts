import { createObjectCsvWriter as createCsvWriter } from 'csv-writer'
import contributorAddresses from './contributor-addresses.json'

calculate()

async function calculate() {
    console.log('calculate')

    const repos: any = {
        // content
        'webapp': 'funding-splits-content',
        'webapp-lfs': 'funding-splits-content',

        // engineering
        'chat': 'funding-splits-engineering',
        'common-utils': 'funding-splits-engineering',
        'content-provider': 'funding-splits-engineering',
        'familiar-word-reading': 'funding-splits-engineering',
        'filamu': 'funding-splits-engineering',
        'herufi': 'funding-splits-engineering',
        'image-picker': 'funding-splits-engineering',
        'keyboard': 'funding-splits-engineering',
        'kukariri': 'funding-splits-engineering',
        'ml-storybook-reading-level': 'funding-splits-engineering',
        'ml-storybook-recommender': 'funding-splits-engineering',
        'model': 'funding-splits-engineering',
        'nyas-space-quest': 'funding-splits-engineering',
        'nyas-space-quest-qd': 'funding-splits-engineering',
        'soga': 'funding-splits-engineering',
        'sound-cards': 'funding-splits-engineering',
        'vitabu': 'funding-splits-engineering',
        'VoltAir': 'funding-splits-engineering',

        // distribution
        'analytics': 'funding-splits-distribution',
        'appstore': 'funding-splits-distribution',
        'launcher': 'funding-splits-distribution',
        'ml-authentication': 'funding-splits-distribution',
        'ml-event-simulator': 'funding-splits-distribution',
        'start-guide': 'funding-splits-distribution',
        'web3-sponsors': 'funding-splits-distribution',
        'website': 'funding-splits-distribution',
    }

    const botContributors: Set<string> = new Set(['dependabot[bot]', 'github-actions[bot]']);

    for (const repo in repos) {
        console.log()
        console.log('repo:', repo)

        const repoCategory = repos[repo]
        const repoDir = `../../${repoCategory}/github_${repo}`
        console.log('repoDir:', repoDir)
        const outputPath = `${repoDir}/FUNDING_SPLITS.csv`
        console.log('outputPath:', outputPath)

        const restApiEndpoint = `https://api.github.com/repos/elimu-ai/${repo}/contributors`
        console.log('restApiEndpoint:', restApiEndpoint)
        const response = await fetch(restApiEndpoint)
        console.log('response.status:', response.status)
        const contributors = await response.json();
        console.log('contributors.length:', contributors.length)
        
        const contributorData: any[] = []
        for (const contributor of contributors) {
            const gitHubUsername = contributor['login']

            if (botContributors.has(gitHubUsername)) {
                continue;
            }
            const contributionCount = contributor['contributions']
            contributorData.push([contributionCount, gitHubUsername])
        }
        console.log('contributorData:', contributorData)

        const csvData = prepareCsvData(contributorData);
        exportToCsv(csvData, outputPath)
    }
}

/**
 * Prepare an array of JSON objects before exporting to CSV.
 * 
 * Sample:
 * 
 * {
 *   ethereum_address: '0x0000000000000000000000000000000000000000',
 *   impact_percentage: 10.00,
 *   github_username: nya-elimu
 * }
 */
function prepareCsvData(contributorData: any[]) {
    console.log('prepareCsvData')

    let totalContributionCount = 0;
    contributorData.forEach(contributor => {
        const contributionCount = contributor[0]
        totalContributionCount += contributionCount
    })
    console.log('totalContributionCount:', totalContributionCount)

    const csvData: any[] = []
    contributorData.forEach(contributor => {
        const contributionCount = contributor[0]
        const impactPercentage = 100 * contributionCount / totalContributionCount

        const gitHubUsername: string = contributor[1]
        
        let ethereumAddress = '0x0000000000000000000000000000000000000000';
        const ethereumAddresses: any = contributorAddresses
        if (ethereumAddresses[gitHubUsername]) {
            ethereumAddress = ethereumAddresses[gitHubUsername]
        }
        
        csvData.push({
            ethereum_address: ethereumAddress,
            impact_percentage: impactPercentage.toFixed(2),
            github_username: gitHubUsername
        })
    })
    return csvData
}

function exportToCsv(csvData: any[], outputPath: string) {
    console.log('exportToCsv')

    console.log('outputPath:', outputPath)
    const csvWriter = createCsvWriter({
        path: outputPath,
        header: [
            {id: 'ethereum_address', title: 'ethereum_address'},
            {id: 'impact_percentage', title: 'impact_percentage'},
            {id: 'github_username', title: 'github_username'}
        ]
    })

    csvWriter
        .writeRecords(csvData)
        .then(() => {
            console.log('The CSV file was written successfully:', outputPath)
        })
}
