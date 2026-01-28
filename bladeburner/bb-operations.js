// /bladeburner/bb-operations.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runBBOperations(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // operations
    } catch (err) {
        ns.print(`bb-operations error: ${err}`);
    }
}
