// /singularity/aug-purchaser.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runAugPurchaser(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // aug buying
    } catch (err) {
        ns.print(`aug-purchaser error: ${err}`);
    }
}
