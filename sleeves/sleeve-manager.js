// /sleeves/sleeve-manager.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runSleeveManager(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // sleeve orchestration
    } catch (err) {
        ns.print(`sleeve-manager error: ${err}`);
    }
}
