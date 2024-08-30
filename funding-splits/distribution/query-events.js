"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const SponsorshipQueue_json_1 = __importDefault(require("./abis/SponsorshipQueue.json"));
const DistributionQueue_json_1 = __importDefault(require("./abis/DistributionQueue.json"));
const csv_writer_1 = require("csv-writer");
const rpcServerAddress = 'https://base-sepolia.blockpi.network/v1/rpc/public';
console.log('rpcServerAddress:', rpcServerAddress);
const provider = new ethers_1.ethers.JsonRpcProvider(rpcServerAddress);
/**
 * Deployment details: https://github.com/elimu-ai/web3-sponsors/tree/main/backend/ignition/deployments
 */
const sponsorshipQueueContract = new ethers_1.ethers.Contract('0x9Af2E73663968fdfb9791b7D6Bd40cd259f0388a', SponsorshipQueue_json_1.default.abi, provider);
/**
 * Deployment details: https://github.com/elimu-ai/web3-sponsors/tree/main/backend/ignition/deployments
 */
const distributionQueueContract = new ethers_1.ethers.Contract('0xB84dcB33eAEAaC81723d91A50674b27f3c5380eD', DistributionQueue_json_1.default.abi, provider);
query();
function query() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('query');
        const sponsorshipQueueEvents = yield sponsorshipQueueContract.queryFilter('*');
        console.log('sponsorshipQueueEvents.length:', sponsorshipQueueEvents.length);
        const sponsorshipAddedEventData = [];
        sponsorshipQueueEvents.forEach((eventLog) => {
            console.log('');
            // console.log('eventLog:', eventLog)
            const blockNumber = eventLog.blockNumber;
            console.log('blockNumber:', eventLog.blockNumber);
            const eventName = eventLog.fragment.name;
            console.log('eventName:', eventName);
            const argResult = eventLog.args;
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
                const argResultArray = argResult[0];
                // console.log('argResultArray:', argResultArray)
                const estimatedCost = argResultArray[0];
                console.log('estimatedCost:', estimatedCost);
                const timestamp = argResultArray[1];
                console.log('timestamp:', timestamp);
                const sponsorAddress = argResultArray[2];
                console.log('sponsorAddress:', sponsorAddress);
                sponsorshipAddedEventData.push([estimatedCost, timestamp, sponsorAddress]);
            }
        });
        const distributionQueueEvents = yield distributionQueueContract.queryFilter('*');
        console.log('distributionQueueEvents.length:', distributionQueueEvents.length);
        const distributionAddedEventData = [];
        distributionQueueEvents.forEach((eventLog) => {
            console.log('');
            // console.log('eventLog:', eventLog)
            const blockNumber = eventLog.blockNumber;
            console.log('blockNumber:', eventLog.blockNumber);
            const eventName = eventLog.fragment.name;
            console.log('eventName:', eventName);
            const argResult = eventLog.args;
            // console.log('argResult:', argResult)
            //
            // Sample:
            // 
            // Result(1) [
            //   Result(3) [
            //     1719830522n,
            //     '0xAD5f3A0433B25fC3933830D2FA008f6780386D97',
            //     0n
            //   ]
            // ]
            if (eventName == 'DistributionAdded') {
                const argResultArray = argResult[0];
                console.log('argResultArray:', argResultArray);
                const timestamp = argResultArray[0];
                console.log('timestamp:', timestamp);
                const distributorAddress = argResultArray[1];
                console.log('distributorAddress:', distributorAddress);
                const distributionStatus = argResultArray[2];
                console.log('distributionStatus:', distributionStatus);
                distributionAddedEventData.push([timestamp, distributorAddress, distributionStatus]);
            }
        });
        prepareCsvData(sponsorshipAddedEventData, distributionAddedEventData);
    });
}
/**
 * Prepare an array of JSON objects before exporting to CSV.
 *
 * Sample:
 *
 * {
 *   ethereum_address: '0x015B5dF1673499E32D11Cf786A43D1c42b3d725C'
 *   sponsorship_count: 1
 *   distribution_count: 0
 *   impact_percentage: 100
 * }
 */
function prepareCsvData(sponsorshipAddedEvents, distributionAddedEvents) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('prepareCsvData');
        console.log('sponsorshipAddedEvents.length:', sponsorshipAddedEvents.length);
        console.log('distributionAddedEvents.length:', distributionAddedEvents.length);
        const csvData = [];
        // Count 'SponsorshipAdded' events per sponsor address
        sponsorshipAddedEvents.forEach(sponsorshipAddedEvent => {
            const estimatedCost = sponsorshipAddedEvent[0];
            const timestamp = sponsorshipAddedEvent[1];
            const sponsorAddress = sponsorshipAddedEvent[2];
            // Check if data already exists for the sponsor address
            let existingData = undefined;
            csvData.forEach(data => {
                // console.log('data:', data)
                if (sponsorAddress == data.ethereum_address) {
                    existingData = data;
                }
            });
            if (!existingData) {
                console.log('Add data for address:', sponsorAddress);
                const newData = {
                    ethereum_address: sponsorAddress,
                    sponsorship_count: 1,
                    distribution_count: 0
                };
                csvData.push(newData);
            }
            else {
                console.log('Update data for address:', sponsorAddress);
                existingData.sponsorship_count++;
            }
        });
        // Count 'DistributionAdded' events per distributor address
        distributionAddedEvents.forEach(distributionAddedEvent => {
            const distributorAddress = distributionAddedEvent[1];
            const distributionStatus = distributionAddedEvent[2];
            // Check if data already exists for the distributor address
            let existingData = undefined;
            csvData.forEach(data => {
                // console.log('data:', data)
                if (distributorAddress == data.ethereum_address) {
                    existingData = data;
                }
            });
            if (!existingData) {
                console.log('Add data for address:', distributorAddress);
                const newData = {
                    ethereum_address: distributorAddress,
                    sponsorship_count: 0,
                    distribution_count: 1
                };
                csvData.push(newData);
            }
            else {
                console.log('Update data for address:', distributorAddress);
                existingData.distribution_count++;
            }
        });
        console.log('csvData:', csvData);
        calculateImpactPercentages(csvData);
        exportToCsv(csvData, 'HIN');
        exportToCsv(csvData, 'TGL');
    });
}
function calculateImpactPercentages(csvData) {
    console.log('calculateImpactPercentages');
    let sponsorshipCountTotal = 0;
    let distributionCountTotal = 0;
    csvData.forEach(csvDataRow => {
        sponsorshipCountTotal += csvDataRow.sponsorship_count;
        distributionCountTotal += csvDataRow.distribution_count;
    });
    console.log('sponsorshipCountTotal:', sponsorshipCountTotal);
    console.log('distributionCountTotal:', distributionCountTotal);
    // Calculate the impact percentage for each sponsor address
    csvData.forEach(csvDataRow => {
        const impactPercentage = 100
            * (csvDataRow.sponsorship_count + csvDataRow.distribution_count)
            / (sponsorshipCountTotal + distributionCountTotal);
        // console.log('impactPercentage:', impactPercentage)
        csvDataRow.impact_percentage = impactPercentage;
    });
    console.log('csvData:', csvData);
}
function exportToCsv(csvData, languageCode) {
    console.log('exportToCsv');
    const outputPath = `FUNDING_SPLITS_${languageCode}.csv`;
    console.log('outputPath:', outputPath);
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: outputPath,
        header: [
            { id: 'ethereum_address', title: 'ethereum_address' },
            { id: 'sponsorship_count', title: 'sponsorship_count' },
            { id: 'distribution_count', title: 'distribution_count' },
            { id: 'impact_percentage', title: 'impact_percentage' }
        ]
    });
    csvWriter
        .writeRecords(csvData)
        .then(() => {
        console.log('The CSV file was written successfully:', outputPath);
    });
}
