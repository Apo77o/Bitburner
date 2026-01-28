// /formulas/formulas-batcher.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runFormulasBatcher(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // formulas-based HWGW
    } catch (err) {
        ns.print(`formulas-batcher error: ${err}`);
    }
}
