// /bladeburner/bb-contracts.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runBBContracts(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // contracts
    } catch (err) {
        ns.print(`bb-contracts error: ${err}`);
    }
}
