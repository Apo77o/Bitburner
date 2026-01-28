// /stanek/stanek-optimizer.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runStanek(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // full Stanek optimization
    } catch (err) {
        ns.print(`stanek-optimizer error: ${err}`);
    }
}
