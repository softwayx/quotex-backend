/**
 * Features the super admin can switch on or off for each paid plan (Basic, Pro).
 * To add a future feature, add one entry here and check for it with `hasFeature` where it is used.
 * Until the admin changes it, a feature is included in the plans listed in `defaultTiers`.
 *
 * Safety features (loss limit, safety lock, accuracy guard, profit protection) are NOT in this list:
 * they protect every user and are always on.
 */
export const FEATURES = [
  // ---- One feature per tab of the Insights page. Each tab shows only when its feature is in the user's plan.
  {
    key: 'insight_overview',
    group: 'Insights tabs',
    name: 'Overview tab',
    label: 'Insights overview: your discipline score and best and worst pair, timeframe and time',
    description: 'The first tab: a discipline score summary and the best and worst pair, timeframe and time of day. Each card only shows if its own tab is also in the plan.',
    defaultTiers: ['PRO'],
  },
  {
    key: 'insight_discipline',
    group: 'Insights tabs',
    name: 'Discipline tab',
    label: 'A discipline score for every session, with what cost you points',
    description: 'A 0 to 100 score for each session: followed the suggested amount, waited after a loss, respected warnings, did not over-trade.',
    defaultTiers: ['PRO'],
  },
  {
    key: 'insight_gap',
    group: 'Insights tabs',
    name: 'Gap between trades tab',
    label: 'See how the wait between trades changes your results',
    description: 'Results by the time waited before a trade, especially after a loss, and how profitable and losing sessions differ in pace.',
    defaultTiers: ['PRO'],
  },
  {
    key: 'insight_patterns',
    group: 'Insights tabs',
    name: 'Patterns tab',
    label: 'Find when your win rate drops and how much profit you give back',
    description: 'Win rate by trade number in a session, a suggested trade limit, and the profit given back after the best point of a session.',
    defaultTiers: ['PRO'],
  },
  {
    key: 'insight_markets',
    group: 'Insights tabs',
    name: 'Pairs and markets tab',
    label: 'See your results by pair, timeframe and OTC or regular market',
    description: 'Results for each pair and each expiry timeframe, and OTC compared with regular markets.',
    defaultTiers: ['PRO'],
  },
  {
    key: 'insight_time',
    group: 'Insights tabs',
    name: 'Time of day tab',
    label: 'See your best and worst time of day',
    description: 'Results for each 3-hour slot of the day (IST).',
    defaultTiers: ['PRO'],
  },
  // ---- On the trade page
  // Note: the trade-details popup (pair, timeframe, OTC) is NOT in this list any more. Every plan, including
  // Basic, always asks for it and always stores it — only whether the Insights tabs can show that data
  // depends on the plan (see the "Insights tabs" group above).
  {
    key: 'live_tips',
    group: 'While trading',
    name: 'Personal tips on the trade page',
    label: 'Personal tips on the trade page, based on your own history',
    description: 'Short tips on the trade card from your recorded trades, for example how long you usually need to wait after a loss.',
    defaultTiers: ['PRO'],
  },
];

export const TIERS = ['BASIC', 'PRO'];
export const INSIGHT_FEATURES = FEATURES.filter((feature) => feature.key.startsWith('insight_')).map((feature) => feature.key);
export const FEATURE_KEYS = FEATURES.map((feature) => feature.key);

/** What every paid plan always includes, whatever the admin ticks. */
export const CORE_FEATURES = [
  'Unlimited trade tracking',
  'Daily plan with a suggested trade amount',
  'Loss protection and safety lock',
  'Accuracy guard and profit protection',
  'What-If risk calculator',
  'History of every session and trade',
  'Record the pair, timeframe and OTC or regular market for every trade',
];

/** { BASIC: { key: bool }, PRO: { key: bool } } from the catalog defaults. */
export const defaultMatrix = () =>
  Object.fromEntries(TIERS.map((tier) => [tier, Object.fromEntries(FEATURES.map((f) => [f.key, f.defaultTiers.includes(tier)]))]));

/** Pro always includes everything Basic has. Returns a fixed copy of the matrix. */
export const normalizeMatrix = (matrix) => {
  const defaults = defaultMatrix();
  const out = { BASIC: {}, PRO: {} };
  for (const { key } of FEATURES) {
    const basic = matrix?.BASIC?.[key] ?? defaults.BASIC[key];
    const pro = matrix?.PRO?.[key] ?? defaults.PRO[key];
    out.BASIC[key] = Boolean(basic);
    out.PRO[key] = Boolean(pro || basic);
  }
  return out;
};

/**
 * The bullet lists shown to customers. Basic: the always-on list plus what the admin ticked for Basic.
 * Pro: "everything in Basic" plus whatever is ticked for Pro only.
 */
export const buildPlanFeatureLists = (matrix) => {
  const m = normalizeMatrix(matrix);
  const basicExtras = FEATURES.filter((f) => m.BASIC[f.key]).map((f) => f.label);
  const proOnly = FEATURES.filter((f) => m.PRO[f.key] && !m.BASIC[f.key]).map((f) => f.label);
  return { BASIC: [...CORE_FEATURES, ...basicExtras], PRO: proOnly };
};

export const featuresOfTier = (matrix, tier) => {
  const m = normalizeMatrix(matrix);
  return FEATURE_KEYS.filter((key) => m[tier === 'PRO' ? 'PRO' : 'BASIC'][key]);
};
