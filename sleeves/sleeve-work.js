// /sleeves/sleeve-work.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runSleeveWork(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // sleeve work
    } catch (err) {
        ns.print(`sleeve-work error: ${err}`);
    }
}
