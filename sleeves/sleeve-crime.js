// /sleeves/sleeve-crime.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runSleeveCrime(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // sleeve crime
    } catch (err) {
        ns.print(`sleeve-crime error: ${err}`);
    }
}
