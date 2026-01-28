// /core/rep-planner.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runRepPlanner(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // rep goals / factions
    } catch (err) {
        ns.print(`rep-planner error: ${err}`);
    }
}
