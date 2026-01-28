// /corp/config.js
export const CORP_CONFIG = {
  defaultName: "Alpha Industries",
  defaultTicker: "AI",
  version: "corpo-v1.0.0",
  paths: {
    corpMode: "/data/corp-mode.txt",
    corpStatus: "/data/corp-status.json",
    corpVersion: "/data/corp-version.txt",
    ramReserve: "/data/corp-ram-reserve.txt",
    deployerConfirm: "/data/deployer-confirm.txt",
    eventsLog: "/data/corp-events.log",
    eventsProcessedIdx: "/data/events-processed.idx",
    locksDir: "/data/locks",
    productAnalyticsSummary: "/data/product-analytics-summary.json",
    aggregatesDir: "/data/aggregates",
    logsDir: "/logs"
  },
  ipc: { queueMaxSize: 10000, processedIndexPath: "/data/events-processed.idx" },
  locks: { lockTimeoutMs: 30000 },
  ram: { defaultReserveGB: 64, ultraLiteMinGB: 8, handshakeTimeoutMs: 5000 },
  workerPool: { maxWorkers: 8, minRamPerWorkerGB: 8, workerScriptPrefix: "/corp/workers" },
  analytics: { sampleIntervalSec: 2, monteCarloSamples: 200, monteCarloHorizonMonths: 12, discountRate: 0.10 },
  telemetry: {
    maxLogLinesPerProduct: 100000,
    rotateKeepFiles: 7,
    prunePolicy: { type: "age", maxAgeMs: 30 * 24 * 3600 * 1000, maxTotalSizeBytes: 500 * 1024 * 1024 },
    snapshotIntervalMs: 5 * 60 * 1000,
    retentionWindowsMs: { allTime: Infinity, last24h: 24 * 3600 * 1000, last1h: 3600 * 1000, lastMinute: 60 * 1000 }
  },
  upgradeROI: { roiThreshold: 0.05, safetyMultiplier: 1.1 },
  safety: { maxSpendFractionPerAction: 0.25, emergencyCashThreshold: 1e8 },
  employee: { moveToInternThreshold: 10.0, restoreFromInternThreshold: 100.0 },
  debug: true,
  testMode: false
};
