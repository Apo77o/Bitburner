// /core/home-upgrader.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runHomeUpgrader(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // home RAM/cores ROI
    } catch (err) {
        ns.print(`home-upgrader error: ${err}`);
    }
}
