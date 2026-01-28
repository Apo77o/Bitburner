// /core/money-planner.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runMoneyPlanner(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // income projections / priorities
    } catch (err) {
        ns.print(`money-planner error: ${err}`);
    }
}
