// /crime/crime-advanced.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runCrimeManager(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // optimized crime
    } catch (err) {
        ns.print(`crime-advanced error: ${err}`);
    }
}
