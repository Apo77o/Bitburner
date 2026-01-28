// /crime/crime-basic.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runCrimeBasic(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // simple crime loop
    } catch (err) {
        ns.print(`crime-basic error: ${err}`);
    }
}
