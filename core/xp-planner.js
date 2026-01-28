// /core/xp-planner.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runXPPlanner(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // XP grind decisions
    } catch (err) {
        ns.print(`xp-planner error: ${err}`);
    }
}
