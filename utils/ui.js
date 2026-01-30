// /utils/ui.js
export function openLog(ns, script = null, host = "home", ...args) {
    try {
        if (!ns.ui?.openTail) return;
        if (script) ns.ui.openTail(script, host, ...args);
        else ns.ui.openTail();
    } catch (err) {
        ns.print(`openLog error: ${err}`);
    }
}
