// /corp/corp-basic.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runCorpBasic(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // basic corp automation
    } catch (err) {
        ns.print(`corp-basic error: ${err}`);
    }
}
