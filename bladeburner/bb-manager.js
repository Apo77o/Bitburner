// /bladeburner/bb-manager.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runBladeburner(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // BB orchestration
    } catch (err) {
        ns.print(`bb-manager error: ${err}`);
    }
}
