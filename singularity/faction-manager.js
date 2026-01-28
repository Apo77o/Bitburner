// /singularity/faction-manager.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runFactionManager(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // invites / faction goals
    } catch (err) {
        ns.print(`faction-manager error: ${err}`);
    }
}
