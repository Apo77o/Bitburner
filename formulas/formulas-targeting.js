// /formulas/formulas-targeting.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runFormulasTargeting(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // formulas-based targeting
    } catch (err) {
        ns.print(`formulas-targeting error: ${err}`);
    }
}
