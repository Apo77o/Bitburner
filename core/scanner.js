// /core/scanner.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runScanner(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // scanning / auto-root / export target
    } catch (err) {
        ns.print(`scanner error: ${err}`);
    }
}
