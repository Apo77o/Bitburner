// /singularity/work-manager.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runWorkManager(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // auto-work
    } catch (err) {
        ns.print(`work-manager error: ${err}`);
    }
}
