// /tests/test-telemetry.js
import { rotateIfNeeded, snapshotAggregates } from "/corp/modules/telemetry.js";
import { CORP_CONFIG } from "/corp/config.js";

export async function run(ns) {
  ns.disableLog("sleep");
  const logPath = "/logs/test-product.txt"; // use .txt for writable log
  // Create synthetic log with 120 lines
  let lines = "";
  for (let i = 0; i < 120; i++) {
    const rec = { ts: Date.now(), profit: i, revenue: i*2, sold: i };
    lines += JSON.stringify(rec) + "\n";
  }
  await ns.write(logPath, lines, "w");

  // Rotate with maxLines = 100
  await rotateIfNeeded(ns, logPath, 100, CORP_CONFIG);

  // Check rotated-index updated
  const idxPath = "/data/rotated-index.json";
  if (!ns.fileExists(idxPath)) { ns.tprint("test-telemetry: rotated-index missing"); return false; }

  // Snapshot aggregates
  const aggregatePath = "/data/aggregates/test-product.json";
  await snapshotAggregates(ns, logPath, aggregatePath, CORP_CONFIG.telemetry.retentionWindowsMs, CORP_CONFIG.analytics.sampleIntervalSec, CORP_CONFIG);
  if (!ns.fileExists(aggregatePath)) { ns.tprint("test-telemetry: aggregate missing"); return false; }

  await ns.write("/logs/test-telemetry-result.txt", `${new Date().toISOString()} - PASS\n`, "a");
  ns.tprint("test-telemetry: PASS");
  return true;
}
