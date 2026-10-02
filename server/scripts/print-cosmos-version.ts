import { getCosmosVersion } from '../src/cosmos/view.js';

// Every build log carries this line so a deployed `version` can be traced back to its build (I6).
console.log(`COSMOS_VERSION=${getCosmosVersion()}`);
