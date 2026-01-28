// /tests/run-tests.js
/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("sleep");

  const tests = [
    "/tests/test-ipc.js",
    "/tests/test-telemetry.js",
    "/tests/test-mc.js"
  ];

  const results = [];

  for (const t of tests) {
    try {
      // Existence check
      if (!ns.fileExists(t)) {
        results.push({ test: t, status: "missing" });
        ns.tprint(`run-tests: MISSING ${t}`);
        continue;
      }

      // Read a small preview to ensure file is not empty/corrupt
      const preview = ns.read(t).slice(0, 200);
      if (!preview || preview.trim().length === 0) {
        results.push({ test: t, status: "empty" });
        ns.tprint(`run-tests: EMPTY ${t}`);
        continue;
      }

      // Try dynamic import with detailed error capture
      let mod;
      try {
        mod = await import(t);
      } catch (impErr) {
        results.push({ test: t, status: "import-error", error: String(impErr) });
        ns.tprint(`run-tests: import failed for ${t}: ${impErr}`);
        continue;
      }

      if (!mod || typeof mod.run !== "function") {
        results.push({ test: t, status: "no-run-export" });
        ns.tprint(`run-tests: ${t} does not export run(ns)`);
        continue;
      }

      // Execute test.run(ns) and capture boolean result
      try {
        const ok = await mod.run(ns);
        results.push({ test: t, status: ok ? "pass" : "fail" });
      } catch (execErr) {
        results.push({ test: t, status: "error", error: String(execErr) });
        ns.tprint(`run-tests: execution error for ${t}: ${execErr}`);
      }

    } catch (e) {
      results.push({ test: t, status: "error", error: String(e) });
      ns.tprint(`run-tests: unexpected error for ${t}: ${e}`);
    }
  }

  // Write results to a .txt file
  await ns.write("/logs/test-results.txt", JSON.stringify({ ts: Date.now(), results }, null, 2) + "\n", "a");
  ns.tprint("Tests complete. See /logs/test-results.txt");
}
