import {PreparationProfile} from "tank.bench-common";
import {ApiPromise, WsProvider} from "@polkadot/api";
import {Keyring} from "@polkadot/keyring";
import {Index} from "@polkadot/types/interfaces";

export default class SubstratePreparationProfile extends PreparationProfile {

    static readonly fileName = __filename;

    static USERS_COUNT = 1000;

    // noinspection JSMethodCanBeStatic
    private stringSeed(seed: number): string {
        return '//user//' + ("0000" + seed).slice(-4);
    }

    async prepare() {
        let USERS_COUNT = SubstratePreparationProfile.USERS_COUNT;

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
        nonces.forEach((nonce, i) => {
            userNoncesArray[i] = nonce
        });
        this.logger.log("All nonces fetched!");

        this.logger.log("Endowing all users from Alice account...");
        let aliceKeyPair = keyring.addFromUri("//Alice");
        let aliceNonce = (await api.query.system.account(aliceKeyPair.address))[0].toNumber();
        this.logger.log("Alice nonce is " + aliceNonce);

        for (let seed  = firstSeed; seed <= lastSeed; seed++) {
            let keypair = keyring.addFromUri(this.stringSeed(seed));

            // should be greater than existential deposit.
            let transfer = api.tx.balances.transfer(keypair.address, 1000000000000000);

            let receiverSeed = this.stringSeed(seed);
            this.logger.log(
                `Alice -> ${receiverSeed} (${keypair.address})`
            );
            await transfer.signAndSend(aliceKeyPair, { nonce: aliceNonce });
            aliceNonce ++;

            if (seed % 200 == 199) {
                // give node some time to breath
                function timeout(ms: number) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }
                await timeout(6000);
            }
        }
        this.logger.log("All users endowed from Alice account!");

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
