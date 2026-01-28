// /utils/files.js
export function loadState(ns) {
    try { return JSON.parse(ns.read("/data/state.txt")); }
    catch { return null; }
}

export function saveState(ns, state) {
    ns.write("/data/state.txt", JSON.stringify(state), "w");
}
