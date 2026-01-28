// /sleeves/sleeve-augments.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runSleeveAugments(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // sleeve aug buying
    } catch (err) {
        ns.print(`sleeve-augments error: ${err}`);
    }
}
