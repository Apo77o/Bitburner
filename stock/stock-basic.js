// /stock/stock-basic.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runStockManager(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // basic non-TIX trading
    } catch (err) {
        ns.print(`stock-basic error: ${err}`);
    }
}
