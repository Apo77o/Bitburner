// /main/startup.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    if (DEBUG) openLog(ns);

    ns.killall();
    ns.run("/main/manager.js", 1);
    ns.tprint("Startup: manager launched.");
}
