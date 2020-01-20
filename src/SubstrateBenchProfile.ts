import {BenchProfile} from "tank.bench-common";
import {Keyring} from "@polkadot/keyring";
import {ApiPromise, WsProvider} from "@polkadot/api";
import {KeyringPair} from "@polkadot/keyring/types";

const TOKENS_TO_SEND = 1;

export default class SubstrateBenchProfile extends BenchProfile {

    private api!: ApiPromise;
    private keyring!: Keyring;

    private threadId!: number;

    private userNoncesArray!: Int32Array;
    private keyPairs!: Map<number, KeyringPair>;

    private usersConfig: any;


    // noinspection JSMethodCanBeStatic
    private stringSeed(seed: number): string {
        return '//user//' + ("0000" + seed).slice(-4);
    }

    private getRandomSeed(): number {
        let firstSeed = this.benchConfig.usersConfig.firstSeed;
        let lastSeed = this.benchConfig.usersConfig.lastSeed;

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
        let senderSeed = this.getRandomSenderSeed();
        let senderKeyPair = this.keyPairs.get(senderSeed)!;
        let nonce = Atomics.add(this.userNoncesArray, senderSeed - this.usersConfig.firstSeed, 1);
        let receiverSeed = this.getRandomReceiverSeed(senderSeed);
        let receiverKeyringPair = this.keyPairs.get(receiverSeed)!;

        /// Logging TODO: figure out levels
        // let senderUri = this.stringSeed(senderSeed);
        // let senderPublic = senderKeyPair.address;
        // let receiverUri = this.stringSeed(receiverSeed);
        // let receiverPublic = receiverKeyringPair.address;

        // this.logger.log(
        //     `${senderUri} (${senderPublic}) -> ${receiverUri} (${receiverPublic}) / nonce ${nonce}`
        // );

        let transfer = this.api.tx.balances.transfer(receiverKeyringPair.address, TOKENS_TO_SEND);
        await transfer.signAndSend(senderKeyPair, {nonce});

        return {code: 10, error: null}
    }
}

