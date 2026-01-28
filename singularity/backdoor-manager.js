// /singularity/backdoor-manager.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runBackdoorManager(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // auto-backdoor
    } catch (err) {
        ns.print(`backdoor-manager error: ${err}`);
    }
}
