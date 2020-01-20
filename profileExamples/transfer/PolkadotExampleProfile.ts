import {BenchProfile, PreparationProfile, Profile} from "tank.bench-common";
import {Keyring} from "@polkadot/keyring";
import {ApiPromise, WsProvider} from "@polkadot/api";
import {KeyringPair} from "@polkadot/keyring/types";
import {Index} from "@polkadot/types/interfaces";

const TOKENS_TO_SEND = 1;
const USERS_COUNT = 1000;

// The base profile that just send one token from some accounts to another ones.
// The account names are //user//0000 to //user//0999
class Bench extends BenchProfile {

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
            this.keyPairs.set(seed, this.keyring.addFromUri(this.stringSeed(seed)));
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

        let transfer = this.api.tx.balances.transfer(receiverKeyringPair.address, TOKENS_TO_SEND);
        await transfer.signAndSend(senderKeyPair, {nonce});

        return {code: 10, error: null}
    }
}

class Preparation extends PreparationProfile {

    // noinspection JSMethodCanBeStatic
    private stringSeed(seed: number): string {
        return '//user//' + ("0000" + seed).slice(-4);
    }

    async prepare() {
        let provider = new WsProvider(this.moduleConfig.wsUrl);

        let api = await ApiPromise.create({provider});

        let keyring = new Keyring({type: 'sr25519'});

        const [chain, nodeName, nodeVersion] = await Promise.all([
            api.rpc.system.chain(),
            api.rpc.system.name(),
            api.rpc.system.version()
        ]);

        this.logger.log(`Bench is connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

        let firstSeed: number = 0;
        let lastSeed: number = USERS_COUNT - 1;

        if (this.commonConfig.sharding.shards > 0 && this.commonConfig.sharding.shardId >= 0) {
            let seedsInShard = USERS_COUNT / this.commonConfig.sharding.shards;
            firstSeed = Math.floor(seedsInShard * this.commonConfig.sharding.shardId);
            lastSeed = Math.floor(firstSeed + seedsInShard) - 1
        }

        let seedsCount = lastSeed - firstSeed + 1;

        let userNonces = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * seedsCount);
        let userNoncesArray = new Int32Array(userNonces);

        let getNoncesPromises = new Array<Promise<number>>();

        this.logger.log("Fetching nonces for accounts...");

        for (let seed = firstSeed; seed <= lastSeed; seed++) {
            getNoncesPromises.push(new Promise<number>(async resolve => {
                let stringSeed = this.stringSeed(seed);
                let keys = keyring.addFromUri(stringSeed);
                let nonce = <Index>await api.query.system.accountNonce(keys.address);
                resolve(nonce.toNumber());
            }));
        }

        let nonces = await Promise.all(getNoncesPromises);
        this.logger.log("All nonces fetched!");

        nonces.forEach((nonce, i) => {
            userNoncesArray[i] = nonce
        });

        return {
            commonConfig: this.commonConfig,
            moduleConfig: this.moduleConfig,
            usersConfig: {
                lastSeed,
                firstSeed,
                userNonces,
                totalUsersCount: USERS_COUNT
            }
        }
    }
}

const profile: Profile = {
    benchProfile: Bench,
    preparationProfile: Preparation,
    configSchema: {
        wsUrl: {
            arg: 'polkadot.wsUrl',
            format: String,
            default: null,
            doc: "WS URL"
        },
    }
};

export default profile;



