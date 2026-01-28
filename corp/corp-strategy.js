// /corp/corp-strategy.js
export const CORP_STRATEGY = {
  riskProfile: "balanced",
  expansionPlan: [
    "Agriculture","Tobacco","Restaurant","Pharmaceutical","Software","Robotics",
    "Healthcare","Energy","Utilities","RealEstate","Aerospace","Biotech",
    "Construction","Mining","Manufacturing","Chemical","Electronics","Automotive",
    "Defense","Education"
  ],
  initialDivisions: [{ industry: "Agriculture", name: "Agri" }],
  productNaming: { tiers: [1,10,100], devBudgetMultiplier: 1_000_000_000, tierSelection: { earlyFunds: 1e10, midFunds: 1e12 } },
  productPortfolioPolicy: "diversify",
  valuationAggressiveness: 0.5,
  stockpile: { stockpileFraction: 0.95, massSellFractionPerTickBase: 0.25 },
  researchPriorities: {
    default: ["Hi-Tech R&D Laboratory","Market-TA.I","Market-TA.II","uPgrade: Capacity.I","Warehouse Manager","DreamSense"],
    overrides: { "Software": ["Hi-Tech R&D Laboratory","Market-TA.I","Market-TA.II","DreamSense"] }
  },
  upgrades: { unlocksFirst: true, buyDreamSenseLevel1AfterWarehouseManager: true, delayShadyAccountingUntilValuation: true, delayGovPartnershipUntilLateGame: true },
  investment: { ipoValuationTarget: 1_000_000_000_000, ipoSellPercent: 0.10, investorAcceptMultiplier: 5, maxRoundsToAccept: 4 },
  abTesting: { enabled: true, testDurationTicks: 300, maxConcurrentTests: 3, metric: "revenue" },
  historicalWindows: { allTime: Infinity, last24hMs: 24 * 3600 * 1000, last1hMs: 3600 * 1000, lastMinuteMs: 60 * 1000 },
  monteCarlo: { samples: 1000, horizonMonths: 24, discountRate: 0.10 }
};
