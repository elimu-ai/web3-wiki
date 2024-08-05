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
function query() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('query');
        const events = yield sponsorshipQueueContract.queryFilter('*');
        console.log('events.length:', events.length);
        events.forEach((eventLog) => {
            console.log('\n');
            console.log('eventLog.blockNumber:', eventLog.blockNumber);
            console.log('eventLog.fragment.name:', eventLog.fragment.name);
            console.log('eventLog.args:', eventLog.args);
        });
    });
}
query();
