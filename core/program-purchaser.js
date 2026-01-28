// /core/program-purchaser.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runProgramPurchaser(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // buy TOR, port openers, Formulas.exe
    } catch (err) {
        ns.print(`program-purchaser error: ${err}`);
    }
}
