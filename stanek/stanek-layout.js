// /stanek/stanek-layout.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runStanekLayout(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // layout building
    } catch (err) {
        ns.print(`stanek-layout error: ${err}`);
    }
}
