// /singularity/reset-manager.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runResetManager(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // reset conditions
    } catch (err) {
        ns.print(`reset-manager error: ${err}`);
    }
}
