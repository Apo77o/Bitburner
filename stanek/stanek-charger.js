// /stanek/stanek-charger.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runStanekCharger(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // charging
    } catch (err) {
        ns.print(`stanek-charger error: ${err}`);
    }
}
