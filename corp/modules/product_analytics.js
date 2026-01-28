// /corp/modules/product_analytics.js
import { atomicWrite } from "/corp/modules/ipc.js";
import { rotateIfNeeded, snapshotAggregates } from "/corp/modules/telemetry.js";
import { CORP_CONFIG } from "/corp/config.js";

function sanitize(s) { return s.replace(/[^a-zA-Z0-9-_]/g, "_"); }

export async function tick(ns, cfg) {
  const corp = ns.corporation.getCorporation();
  if (!corp) return;

  for (const divName of corp.divisions) {
    try {
      const div = ns.corporation.getDivision(divName);
      if (!div.makesProducts) continue;

      for (const pName of div.products) {
        try {
          const p = ns.corporation.getProduct(divName, pName);
          const sold = p.sold ?? 0;
          const revenue = p.revenue ?? 0;
          const cost = p.cost ?? 0;
          const profit = revenue - cost;
          const rating = p.rat ?? p.rating ?? 0;

          const rec = {
            ts: Date.now(),
            iso: new Date().toISOString(),
            div: divName,
            product: pName,
            sold,
            revenue,
            cost,
            profit,
            rating,
            funds: corp.funds
          };

          // Use .txt for product logs so ns.write accepts them
          const logPath = `${CORP_CONFIG.paths.logsDir}/product-${sanitize(divName)}-${sanitize(pName)}.txt`;
          await ns.write(logPath, JSON.stringify(rec) + "\n", "a");

          await rotateIfNeeded(ns, logPath, CORP_CONFIG.telemetry.maxLogLinesPerProduct, CORP_CONFIG);

          const aggregatePath = `${CORP_CONFIG.paths.aggregatesDir}/${sanitize(divName)}-${sanitize(pName)}.json`;
          await snapshotAggregates(ns, logPath, aggregatePath, CORP_CONFIG.telemetry.retentionWindowsMs, CORP_CONFIG.analytics.sampleIntervalSec, CORP_CONFIG);

          const summaryPath = CORP_CONFIG.paths.productAnalyticsSummary;
          let summary = {};
          if (ns.fileExists(summaryPath)) {
            try { summary = JSON.parse(ns.read(summaryPath)); } catch { summary = {}; }
          }
          summary[`${divName}:${pName}`] = { ts: rec.ts, last: rec };
          await atomicWrite(ns, summaryPath, JSON.stringify(summary, null, 2));
        } catch (e) {
          ns.print(`product_analytics: error for ${divName}/${pName}: ${e}`);
        }
      }
    } catch (e) {
      ns.print(`product_analytics: division ${divName} error: ${e}`);
    }
  }
}
