// /stock/stock-tix.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runStockTIX(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // full TIX trading
    } catch (err) {
        ns.print(`stock-tix error: ${err}`);
    }
}
