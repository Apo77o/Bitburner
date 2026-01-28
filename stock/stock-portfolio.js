// /stock/stock-portfolio.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runStockPortfolio(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // portfolio balancing
    } catch (err) {
        ns.print(`stock-portfolio error: ${err}`);
    }
}
