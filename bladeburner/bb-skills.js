// /bladeburner/bb-skills.js
import { DEBUG } from "/utils/config.js";
import { openLog } from "/utils/ui.js";

export async function runBBSkills(ns, state) {
    try {
        if (DEBUG) openLog(ns);
        // skills
    } catch (err) {
        ns.print(`bb-skills error: ${err}`);
    }
}
/** @param {NS} ns */
export async function main(ns) {

}