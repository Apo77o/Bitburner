// /core/hacknet.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runHacknet(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // Hacknet ROI logic
    } catch (err) {
        ns.print(`hacknet error: ${err}`);
    }
}
