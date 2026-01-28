// /core/batcher.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runBatcher(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // HWGW logic
    } catch (err) {
        ns.print(`batcher error: ${err}`);
    }
}
