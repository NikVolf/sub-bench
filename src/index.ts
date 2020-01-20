import SubstrateModule from "./SubstrateModule";

// noinspection JSIgnoredPromiseFromCall
new SubstrateModule().bench().catch(e => {
    console.error(e);
    process.exit(-1);
});
