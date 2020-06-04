import {BenchProfile, TransactionResult} from "tank.bench-common";
import {Keyring} from "@polkadot/keyring";
import {ApiPromise, WsProvider} from "@polkadot/api";
import {KeyringPair} from "@polkadot/keyring/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";

const TOKENS_TO_SEND = 1;

const PREGENERATE_TRANSACTIONS = 21000;

export default class SubstrateBenchProfile extends BenchProfile {

    private api!: ApiPromise;
    private keyring!: Keyring;

    private threadId!: number;

    private userNoncesArray!: Int32Array;
    private keyPairs!: Map<number, KeyringPair>;

    private usersConfig: any;

    private preparedTransactions: any[] = [];

    private currentTransactionIndex: any = 0;

    // noinspection JSMethodCanBeStatic
    private stringSeed(seed: number): string {
        return '//user//' + ("0000" + seed).slice(-4);
    }

    private getRandomSeed(): number {
        let firstSeed = 25 * this.threadId;
        let lastSeed = 25*(this.threadId+1)-1;

        return Math.floor(Math.random() * (lastSeed - firstSeed + 1)) + firstSeed;
    }

    // noinspection JSMethodCanBeStatic
    private getVeryRandomSeed(): number {
        return Math.floor(Math.random() * this.benchConfig.usersConfig.totalUsersCount);
    }

    async asyncConstruct(threadId: number) {
        // ed25519 and sr25519
        this.threadId = threadId;
        this.keyring = new Keyring({type: 'sr25519'});

        let provider = new WsProvider(this.benchConfig.moduleConfig.wsUrl);

        this.api = await ApiPromise.create({provider});

        this.usersConfig = this.benchConfig.usersConfig;
        this.userNoncesArray = new Int32Array(this.benchConfig.usersConfig.userNonces);

        this.keyPairs = new Map<number, KeyringPair>();
        for (let seed = 0; seed < this.usersConfig.totalUsersCount; seed++) {
            let keypair = this.keyring.addFromUri(this.stringSeed(seed));
            this.keyPairs.set(seed, keypair);
        }

        this.logger.log(`Pregenerating ${PREGENERATE_TRANSACTIONS} transactions for thread ${threadId}`);

        for (let tx = 0; tx < PREGENERATE_TRANSACTIONS; tx++) {
            let senderSeed = this.getRandomSenderSeed();
            let senderKeyPair = this.keyPairs.get(senderSeed)!;
            let nonce = Atomics.add(this.userNoncesArray, senderSeed, 1);
            let receiverSeed = this.getRandomReceiverSeed(senderSeed);
            let receiverKeyringPair = this.keyPairs.get(receiverSeed)!;

            let transfer = this.api.tx.balances.transfer(receiverKeyringPair.address, TOKENS_TO_SEND);
            let signedTransaction = transfer.sign(senderKeyPair, {nonce});

            this.preparedTransactions.push({ from: senderSeed, to: receiverSeed, signed: signedTransaction, nonce });
        }
    }

    private getRandomReceiverSeed(senderSeed: number) {
        let seed = this.getVeryRandomSeed();
        if (seed === senderSeed)
            seed++;
        if (seed >= this.usersConfig.totalUsersCount - 1)
            seed = 0;
        return seed;

    }

    private getRandomSenderSeed() {
        return this.getRandomSeed();
    }

    async commitTransaction(uniqueData: string) {
        let transaction = this.preparedTransactions[this.currentTransactionIndex];
        this.currentTransactionIndex += 1;
        //this.logger.log(`returning ${transaction.from}->${transaction.to}(${transaction.nonce})`);

        await transaction.signed.send();

        return {code: 10, error: null}
    }
}

