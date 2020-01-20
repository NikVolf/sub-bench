import {BuiltinProfile} from "tank.bench-common";
import SubstrateBenchProfile from "./SubstrateBenchProfile";
import SubstratePreparationProfile from "./SubstratePreparationProfile";
import configSchema from "./config/configSchema";

const profile: BuiltinProfile = {
    benchProfile: SubstrateBenchProfile,
    fileName: __filename,
    name: "default",
    preparationProfile: SubstratePreparationProfile,
    configSchema: configSchema,
    telemetryProfile: undefined
};

export default profile;
