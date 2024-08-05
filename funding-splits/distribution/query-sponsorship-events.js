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
const rpcServerAddress = 'https://base-sepolia.blockpi.network/v1/rpc/public';
console.log('rpcServerAddress:', rpcServerAddress);
const provider = new ethers_1.ethers.JsonRpcProvider(rpcServerAddress);
// console.log('provider:', provider)
const sponsorshipQueueContract = new ethers_1.ethers.Contract('0x9Af2E73663968fdfb9791b7D6Bd40cd259f0388a', SponsorshipQueue_json_1.default.abi, provider);
// console.log('sponsorshipQueueContract:', sponsorshipQueueContract)
query();
function query() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('query');
        const events = yield sponsorshipQueueContract.queryFilter('*');
        console.log('events.length:', events.length);
        const eventData = [];
        events.forEach((eventLog) => {
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
                eventData.push([estimatedCost, timestamp, sponsorAddress]);
            }
        });
        exportToCsv(eventData);
    });
}
function exportToCsv(eventData) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('exportToCsv');
        console.log('eventData.length:', eventData.length);
        // Count events per sponsor address
        const csvData = [];
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
            const estimatedCost = sponsorshipEvent[0];
            const timestamp = sponsorshipEvent[1];
            const sponsorAddress = sponsorshipEvent[2];
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
                    distribution_count: 0,
                    impact_percentage: 0 // TODO
                };
                csvData.push(newData);
            }
            else {
                console.log('Update data for address:', sponsorAddress);
                existingData.sponsorship_count++;
            }
        });
        console.log('csvData:\n', csvData);
        // Export to CSV
        // TODO
    });
}
