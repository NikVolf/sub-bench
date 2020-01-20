import {BlockchainModule, BuiltinProfile} from "tank.bench-common";
import Constants from "./constants/Constants";
import SubstrateefaultProfile from "./SubstrateDefaultProfile";
import configSchema from "./config/configSchema";

export default class SubstrateModule extends BlockchainModule {

    getBuiltinProfiles(): BuiltinProfile[] {
        return [SubstrateefaultProfile];
    }


    getConfigSchema(): any {
        return configSchema;
    }

    getDefaultConfigFilePath(): string | null {
        return Constants.defaultConfigFilePath();
    }
}
