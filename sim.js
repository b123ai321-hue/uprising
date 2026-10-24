// sim.js: the rules. No drawing here, only numbers. S is the whole saved game state.
// Turn = 1 week. Player is ALWAYS the insurgent movement (DESIGN.md CORE FRAMING).
'use strict';

// ---- seeded random numbers, so a country always gets the same invented regime ----
function rngFrom(seed) { let h = seed >>> 0 || 1; return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909), h ^= h >>> 16) >>> 0) / 4294967296; }
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rnd() { S.seed = (Math.imul(S.seed, 1103515245) + 12345) >>> 0; return S.seed / 4294967296; }   // saved with the game

const PHASES = ['', 'Lone Agitator', 'Cell', 'Movement', 'Uprising', 'Civil War'];
const FACTIONS = {
  lantern: { n: 'Lantern Accord', d: 'liberty · +30% from Speak/Pamphlet' },
  commons: { n: 'Iron Commons', d: 'workers · cheaper Strike, militia +15%' },
  oath:    { n: 'Green Oath', d: 'land · Hide works better, +defence' },
};
// Invented regime + leader names (built from syllables; never real people)
const REG_A = ['Gilt', 'Iron', 'Grey', 'Stone', 'Silent', 'Crown', 'Ash', 'Granite', 'Black', 'Pale'];
const REG_B = ['Throne', 'Directorate', 'Council', 'Order', 'Regency', 'Mandate', 'Concord', 'Tribunal'];
const SYL = ['va', 'ren', 'tal', 'or', 'kes', 'mir', 'dun', 'sel', 'vor', 'ath', 'lin', 'cor', 'bry', 'esk', 'ul'];
function inventName(r) { const s = () => SYL[r() * SYL.length | 0]; const a = s() + s(), b = s() + s() + s(); return a[0].toUpperCase() + a.slice(1) + ' ' + b[0].toUpperCase() + b.slice(1); }
// 0.2.1h momentum tuning (Director balance pass 2). Change these numbers to rebalance.
// Director asked for +1 recruit/week, spread at 3 held, thin 15%; the greedy bot won ~70% with those,
// so these are retuned to land at 30-50% (see CHANGELOG 0.2.1h).
// Defections (0.3.0a): unpaid = per unpaid week; fight = ordered against a crowd with ≥ fightSupp% support;
// split = extra once you hold splitAt+ provinces (the elite splits); join = share that join you; gear = chance they bring arms.
// Losing an attack (0.3.0b): casualties ×lossMul, +lossHeat heat, −lossSupp% support in that province (people blame you).
// Cells (DESIGN.md "CELLS FIX"). Each cell has its own province heat c.heat (0-100).
// Weekly arrest chance by that heat: < 30 → arrestLo, 30-69 → arrestMid, 70+ → arrestHi; a dark cell halves it.
// Each awake cell per week: +cellSupp% support (stops at cellCap%), +cellRecruits people, +cellCash $ (in $10K points), +cellHeat local heat.
// A dark cell pays nothing and cools by darkCool a week. linkExpose = chance a busted cell exposes each linked cell.
const BAL = { aiReplace: 1, aiRaidMul: 2, aiDig: 1, aiCrack: 3, aiProp: 1, aiCounter: 2, aiCounterTake: 0.5, aiCounterLoss: 0.2, aiGuardHits: 5, aiGuardHeat: 2, aiHitDecay: 0.6, aiWeakAid: 2, aiBandwagon: 1, aiFacSwing: 2,   // 0.9.0 regime plan
  tradeVal: 1, shortUp: 1, shortSupp: 0.5, budgetLowWk: 2, pactTroops: 12, pactLift: 0.25, pactCallEvery: 8, pactCallCash: 3, pactBreak: 15, unrestKeepCap: 1,   // 0.8.0 economy + pacts
  afterWeeks: 20, sancChance: 0.2, sancMax: 2, sancBite: { oil: 2, banks: 3, trade: 1.5, arms: 1 }, invChance: 0.1, invWeeks: 6, invStr: 40, invDef: 0.5, afterHarden: 20,   // 0.7.0 after the revolt
  dealChance: 0.07, dealWeeks: 2, dealAcc: 3, dealRef: 5, dealLapse: 2, dealCash: 3, dealArms: 1, envoyHeat: 6, recogSupp: 2, wantHeat: 6, wantCash: 2, wantRival: 10, regAidChance: 0.15, regAid: 6,   // 0.6.2 foreign deals
  rlCap: 15, rlBackHeat: 16,   // 0.5.3: best Rally line caps at +15%, a backfire draws 16 heat
  lossMul: 2, lossHeat: 15, lossSupp: 3,
  arrestLo: 0.015, arrestMid: 0.04, arrestHi: 0.12, cellSupp: 2, cellCap: 60, cellRecruits: 40, cellCash: 0.2, cellHeat: 2, darkCool: 1, flagHeat: 10, linkExpose: 0.2,
  defUnpaid: 0.05, defUnpaidWk: 0.05, defFight: 0.006, fightSupp: 40, defSplit: 0.012, splitAt: 4, defJoin: 0.6, defGear: 0.5, defArmy: 0.5,
  regime: 2.5, minLoss: 1, recruit: 1, recruitEarly: 3, earlyWeeks: 12, recruitEvery: 12, digBonus: 0.5, digWeeks: 2, digMin: 0, unscoutedLoss: 0.25, refrontLoss: 0.4, refrontWeeks: 2,
  // 0.4.0 regime response: threat weights, faction push, rung effects
  thHeld: 6, thSupp: 0.8, thFight: 4, thHeat: 0.15, rungPer: 30, facPush: 200, downWeeks: 2, facDrift: 0.05,
  r1Heat: 1, r2Curfew: 1, r3Army: 3, r3Meddle: 2, r4Infl: 0.5, r4Every: 2, r5Garrison: 1, r5Anger: 1, rungCost: 2,
  // 0.5.0a grievances: weekly support per severity pip, Organize boost per pip, its heat, crackdown spawn chance
  oppJoin: 40, oppSplit: 5, oppRed: 30, oppGv: 1.5, oppSpeech: 4, oppPeople: 4, oppCash: 0.05, oppInfo: 0.3, oppLegit: 0.2, oppCatch: 0.25, persChance: 0.15, persRung: 2, persLoy: 6, persSupp: 2, persHit: 3,   // 0.5.6 persecution   // 0.5.4 opposition factions
  gvSupp: 0.05, gvPlay: 4, gvHeat: 4, gvSpawn: 0.5,
  income: 0.05, spreadAt: 4, spreadSupp: 2, thin: 0.07, reinfMax: 1 };
// 0.3.0 real numbers: 1 strength point = MEN people, so a 7% garrison loss is real (4,000 → 3,720)
const MEN = 250;
// 0.3.0 economy numbers (see DESIGN.md "Balance 0.3.0"). Costs are in regime budget points per MEN soldiers.
const ECO = { armyPay: 0.4, policePay: 0.3, garPay: 0.15, debtShare: 0.15, subShare: 0.3, fightOut: 15, quietOut: 5,
  donFull: 120, donExp: 1, printInfl: 3, cutInfl: 2, inflCool: 1, upkeepWarn: 0.8, base0: 24, anger: 3, inflRecruit: 0.3 };
const TERR = ['plains', 'hills', 'forest', 'marsh', 'urban'], TDEF = { plains: 1, hills: 1.25, forest: 1.2, marsh: 1.15, urban: 1.3 };

// ---- Economy core: Natural Earth GDP/pop fields (World Bank/IMF snapshot, approximate) ----
function economyOf(info, r) {
  const pop = info.pop || 1e6, gdp = info.gdp || 1e4;     // gdp in million USD
  const pc = gdp * 1e6 / pop;
  return {
    pop, gdp, pc: Math.round(pc), budget: Math.round(gdp * (0.25 + r() * 0.15)),
    debt: Math.round(30 + r() * 90), reserves: Math.round(gdp * (0.05 + r() * 0.3)),
    industry: Math.round(clamp(20 + Math.log10(pc) * 12 + (info.eco <= '2' ? 15 : 0), 5, 99)),
    imports: Math.round(20 + r() * 50),
  };
}
// Security Capability 0-100 from the economy table + a regime-type modifier (CHANGE 9)
function securityCap(E, mod) { return Math.round(clamp(12 * Math.log10(E.pc / 300) + E.industry * 0.35 + mod, 5, 95)); }

// ---- new game in a country. M = the country map file, info = world.json entry ----
function newGame(M, info, powers) {
  const r = rngFrom(hashStr(M.i));
  const E = economyOf(info, r), C = countryData(M.i, info);
  const regime = { n: 'The ' + REG_A[r() * REG_A.length | 0] + ' ' + REG_B[r() * REG_B.length | 0], leader: 'Marshal ' + inventName(r), mod: Math.round(r() * 25 - 10) };
  const sc = securityCap(E, regime.mod);
  const n = M.p.length;
  let home = Math.floor(r() * n); if (home === M.cap.p) home = (home + 1) % n;
  const P = M.p.map((p, i) => ({
    s: i === home ? 8 : Math.round(r() * 4), o: 'R',
    g: Math.round((2 + sc / 30) * (i === M.cap.p ? 2 : 1) * MEN * BAL.regime), cur: 0, out: 100,   // out = province output %
    t: i === M.cap.p ? 'urban' : TERR[(r() * 4) | 0],
    urb: i === M.cap.p ? 1 : clamp(1 - p.r / 300, 0.35, 0.9),     // smaller provinces = more urban
  }));
  return {
    v: 1, iso: M.i, name: info.n, week: 1, phase: 1, seed: hashStr(M.i + Date.now()),
    supp: 1, wealth: 6, arms: 0, heat: 5, militia: 0, regulars: 0, acts: 2,
    lead: null, unity: 100, E, sc, regime, home, P,
    cells: [], cards: { enc: 0, burn: 0, cash: 0, cell: 0 }, fusion: 0, esc: 0,
    powers: powers.map((p, k) => ({ iso: p.iso, n: p.n, gov: inventName(rngFrom(hashStr(p.iso))) + ' Government', rel: k === 0 ? 10 : -15, st: 'Neutral' })),
    cease: 0, ceaseCd: 0, neg: 0, strikeT: 0, won: false, over: null, sel: home, last: null,
    log: [], uprisingWeek: 0, C, men: MEN, saveV: SAVE_VER, rung: 0, rungDown: 0, threat: 0, heldWas: 0, fac: { hardliners: 20, moderates: 10, security: 30, oligarchs: 25 }, season: seasonOf(1), weather: 'clear',
    R: { base: 0, reserves: 0, infl: 2, unpaid: 0, sub: 1, short: false, lines: null }, why: {},
    U: spawnRegime(r, n, M.cap.p, sc), nextId: 100,
  };
}
// Regime money in budget points/week: bigger states (budget vs GDP) can pay for more (scales off data/countries.js)
// 0.6.1 regime type, picked at new game. Small modifiers, all here: arrest = cell arrest chance ×, reinf = garrison refill ×,
// heatWk = heat added each week, cash = starting wealth +, fac = starting regime-faction loyalty +, rel = foreign powers' opinion +
const GOV = {
  junta:     { arrest: 1.15, reinf: 1.2, fac: { hardliners: 15, moderates: -15 } },   // fast crackdowns, low loyalty
  party:     { arrest: 1.3, heatWk: 0.3, fac: { security: 10 } },                     // informers everywhere
  theocracy: { reinf: 0.9, heatWk: 0.2, fac: { hardliners: 10, moderates: -10 } },    // faith factions split
  monarchy:  { reinf: 0.9, fac: { security: 15, oligarchs: 10, moderates: -10 } },    // court intrigue
  oligarchy: { arrest: 0.85, cash: 3, fac: { oligarchs: 20 } },                       // bribes work
  puppet:    { reinf: 1.1, rel: 10, fac: { moderates: -10 } },                        // foreign powers matter more
};
const gm = (k, d) => { const g = S && S.gov && GOV[S.gov]; return g && g[k] != null ? g[k] : d; };   // modifier or default
function govStart(S, t) {   // apply a picked type once at the start
  const g = GOV[t]; if (!g) return; S.gov = t; S.wealth += g.cash || 0;
  for (const k in g.fac || {}) S.fac[k] = clamp(S.fac[k] + g.fac[k], -100, 100);
  if (g.rel) S.powers.forEach(p => p.rel = clamp(p.rel + g.rel, -100, 100));
}
function regimeStart(S) { S.R.base = Math.round((ECO.base0 + 40 * S.C.budget / S.C.gdp) * BAL.regime); S.R.reserves = Math.round(S.R.base * (2 + 20 * S.C.reserves / S.C.gdp)); }
// Old saves (before 0.3.0) used small strengths: scale them up once
// Save versions: 1 = before 0.3.0 (small strengths), 2 = 0.3.0-0.3.0a, 3 = 0.3.0b first pass, 4 = 0.3.0b cells fix. Each step upgrades one version.
const SAVE_VER = 15;
function upgradeSave(S, info) {
  if (!S.saveV) S.saveV = S.men ? 2 : 1;                           // old saves had no number: guess from their shape
  if (S.saveV < 2) { migrate(S, info); S.saveV = 2; }              // 1 → 2: real headcounts + economy
  if (S.saveV < 3) {                                               // 2 → 3: Army HQ is elite, fill any missing economy fields
    S.U.forEach(u => { if (u.id === 1 && u.type === 'army') u.elite = true; });
    S.R = Object.assign({ base: 0, reserves: 0, infl: 2, unpaid: 0, sub: 1, short: false, lines: null }, S.R || {});
    S.why = S.why || {}; S.P.forEach(p => { if (p.out == null) p.out = 100; });
    if (!S.R.base) regimeStart(S); S.saveV = 3;
  }
  if (S.saveV < 4) {                                               // 3 → 4: cells get their own heat; links point at cell IDs
    S.cells.forEach((c, k) => { c.heat = c.heat || 0; c.dark = !!c.dark; c.link = c.link >= 0 && S.cells[c.link] ? S.cells[c.link].id : -1; });
    S.saveV = 4;
  }
  if (S.saveV < 5) { regimeInit(S); S.saveV = 5; }                // 4 → 5: escalation rung + regime factions
  if (S.saveV < 6) { gvEnsure(); S.saveV = 6; }                    // 5 → 6: grievance cards
  if (S.saveV < 7) { S.said = S.said || {}; S.saveV = 7; }         // 6 → 7: how often each Rally line was used
  if (S.saveV < 8) { oppEnsure(); S.saveV = 8; }                   // 7 → 8: 12 opposition factions + leaders
  if (S.saveV < 9) { minorEnsure(); S.saveV = 9; }                 // 8 → 9: the country's invented minority
  if (S.saveV < 10) { S.gov = S.gov || null; S.saveV = 10; }      // 9 → 10: regime type (old games: none, no modifiers)
  if (S.saveV < 11) { S.powers.forEach(p => { p.deal = p.deal || null; }); S.saveV = 11; }   // 10 → 11: foreign deal offers
  if (S.saveV < 12) { if (S.won) afterEnsure(S); S.saveV = 12; }
  if (S.saveV < 13) { S.short = S.short || { food: 0, fuel: 0 }; S.powers.forEach(p => { p.pact = p.pact || (p.st === 'Ally' ? { w: S.week, due: S.week + BAL.pactCallEvery } : null); }); if (S.after && S.after.inv) S.after.inv.path = S.after.inv.path || invPath(S.after.inv.p); S.saveV = 13; }   // 12 → 13: economy + pacts
  if (S.saveV < 14) { aiEnsure(S); S.saveV = 14; }                // 13 → 14: regime plan / intent
  if (S.saveV < 15) { const pl = S.ai && S.ai.plan; if (pl && pl.k === 'bribe') pl.k = 'propaganda'; S.saveV = 15; }   // 14 → 15: intent kind renamed   // 11 → 12: play on after the revolt
  return S;
}
function migrate(S, info) {
  if (S.men) return S;
  S.P.forEach(p => { p.g *= MEN; p.out = 100; }); S.U.forEach(u => { u.str *= MEN; if (u.reg) u.reg *= MEN; if (u.id === 1) u.elite = true; });
  Object.assign(S, { C: countryData(S.iso, info || {}), men: MEN, season: seasonOf(S.week), weather: 'clear', R: { base: 0, reserves: 0, infl: 2, unpaid: 0, sub: 1, short: false, lines: null }, why: {} });
  regimeStart(S); return S;
}

// ---- calendar, seasons and weather (CHANGE 13 B1). Week 1 = 4 Jan 2027 ----
const dateOf = w => new Date(Date.UTC(2027, 0, 4) + (w - 1) * 7 * 864e5);
function seasonOf(w) { const m = dateOf(w).getUTCMonth(); return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn'; }
const isWinter = () => S && S.season === 'winter';
// mud: March-April and October-November; armour (regime Army) can't leave the roads
const isMud = () => S && [2, 3, 9, 10].includes(dateOf(S.week).getUTCMonth());
const isRoad = i => S.P[i].t === 'plains' || S.P[i].t === 'urban';     // plains and cities count as roads
// weekly weather by season: [rain, snow, storm] chances; the rest is clear
const WX = { winter: [0.1, 0.5, 0.05], spring: [0.4, 0.02, 0.05], summer: [0.15, 0, 0.1], autumn: [0.4, 0.05, 0.1] };
function rollWeather() { const [a, b, c] = WX[S.season], x = rnd(); return x < a ? 'rain' : x < a + b ? 'snow' : x < a + b + c ? 'storm' : 'clear'; }

// ---- money + people formatting (USD, headcounts) ----
const WEALTH_USD = 10000;    // 1 wealth point = $10K
function fmtN(n) { n = Math.round(n); const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : a >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : a >= 1e4 ? Math.round(n / 1e3) + 'K' : a >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : '' + n; }
const usd = w => (w < 0 ? '−$' : '$') + fmtN(Math.abs(w) * WEALTH_USD);
const heads = () => Math.round(S.supp * S.C.pop / 10000);          // 1 supporter point = pop/10,000 people
const unitName = n => n < 600 ? 'company' : n < 1500 ? 'battalion' : n < 5000 ? 'brigade' : 'division';

// ---- helpers ----
let S = null, MAP = null;        // S = state, MAP = loaded country file
const held = () => S.P.filter(p => p.o === 'P').length;
const adjHeld = i => MAP.p[i].a.some(j => S.P[j].o === 'P');
const avgSupport = () => S.P.reduce((a, p) => a + p.s, 0) / S.P.length;
const cellsIn = i => S.cells.filter(c => c.p === i).length;
function log(msg, kind) { S.log.unshift({ w: S.week, t: msg, k: kind || '' }); if (S.log.length > 40) S.log.pop(); }
function grow(i, amt) { const p = S.P[i]; if (p.cur > 0 && amt > 0) amt = 0; p.s = clamp(p.s + amt, 0, 100); }
function stateOf(rel) { return rel >= 60 ? 'Ally' : rel >= 30 ? 'Backer' : rel <= -40 ? 'Hostile' : 'Neutral'; }

// Regime reinforcements share one weekly allowance (S.reinf is reset each End Week)
function reinforce() { if ((S.reinf || 0) >= BAL.reinfMax + (S.rung >= 5 ? 1 : 0) ||   // rung 5: allied regimes send help
    (S.R && S.R.short)) return false;   // broke regimes can't add units
  S.reinf = (S.reinf || 0) + 1; return true; }

// ---- player actions. Each: phase needed, cost text, can(i), run(i) ----
const ACTIONS = [
  { id: 'speak', n: 'Speak', ph: 1, c: '+heat', run(i) {
      const b = S.lead === 'lantern' ? 1.3 : 1; const g = Math.round((4 + rnd() * 3) * b * (0.6 + S.P[i].urb * 0.6));
      grow(i, g); const add = 1 + Math.floor(S.P[i].s / 10); S.supp += add; S.heat += 5;
      return `Spoke in ${MAP.p[i].n}: support +${g}%, +${add} supporters`; } },
  { id: 'pamph', n: 'Pamphlet', ph: 1, c: '$20K', can: () => S.wealth >= 2, run(i) {
      S.wealth -= 2; const b = S.lead === 'lantern' ? 1.3 : 1;
      grow(i, Math.round(3 * b)); MAP.p[i].a.forEach(j => grow(j, Math.round(3 * b))); S.supp += 1; S.heat += 3;
      return `Pamphlets in ${MAP.p[i].n} and neighbours`; } },
  { id: 'hide', n: 'Hide', ph: 1, c: '−heat', run() { const h = S.lead === 'oath' ? 18 : 12; S.heat -= h; return `Lay low: heat −${h}`; } },
  { id: 'fund', n: 'Fundraise', ph: 2, c: '+wealth', run() { const g = 2 + Math.floor(S.supp / 8); S.wealth += g; S.heat += 2; return `Donations: +${usd(g)}`; } },
  { id: 'cell', n: 'Safehouse cell', ph: 2, c: '$40K · home, held or next to them', can: i => S.wealth >= 4 && cellSpot(i), run(i) {
      S.wealth -= 4; const prev = S.cells.length ? S.cells[S.cells.length - 1].id : -1;      // link = the ID of the last cell
      S.cells.push({ id: S.nextId++, p: i, link: prev, comp: !!S.cards.cell, known: false, heat: 0, dark: false, mp: 2, path: [] }); S.heat = Math.max(0, S.heat - 4);
      return `New cell in ${MAP.p[i].n}` + (prev >= 0 && !S.cards.cell ? ' (linked to the last cell)' : ''); } },
  { id: 'dark', n: 'Cell: go dark / wake', ph: 2, c: 'a cell here', can: i => cellsIn(i) > 0, run(i) {
      const c = S.cells.find(c => c.p === i && c.id === (S.darkId || c.id)) || S.cells.find(c => c.p === i); S.darkId = 0; c.dark = !c.dark;
      return c.dark ? `Cell in ${MAP.p[i].n} goes dark: no payoff, half the arrest risk, cools 1 heat/week` : `Cell in ${MAP.p[i].n} is active again`; } },
  { id: 'buy', n: 'Buy arms', ph: 2, c: '$50K', can: () => S.wealth >= 5, run() { S.wealth -= 5; S.arms += 3; S.heat += 4; return 'Bought arms: armory +3'; } },
  { id: 'organize', n: 'Organize grievance', ph: 2, c: '+heat', can: i => !!(S.P[i].gv && S.P[i].gv.length), run(i) {
      const L = S.P[i].gv, k = L[S.gvPick] ? S.gvPick : 0, g = L.splice(k, 1)[0], G = GRIEV[g.k]; S.gvPick = 0;   // the card is used up
      grow(i, BAL.gvPlay * g.sev); S.heat += BAL.gvHeat * g.sev; S.lastPlay = { p: i, k: g.k };
      return `Organized around "${G.t}" in ${MAP.p[i].n}: +${BAL.gvPlay * g.sev}% support, +${BAL.gvHeat * g.sev} heat`; } },
  { id: 'rally', n: 'Rally', ph: 3, c: '++heat', run(i) {
      const m = S.rallyMul == null ? 1 : S.rallyMul; S.rallyMul = null;   // 0.5.2: the chosen speech line scales the rally
      if (m < 0) { grow(i, -3); MAP.p[i].a.forEach(j => grow(j, -1)); S.heat += BAL.rlBackHeat; S.powers.forEach(p => p.rel = clamp(p.rel - 2, -100, 100));
        return `Rally in ${MAP.p[i].n} BACKFIRED: −3% support, +${BAL.rlBackHeat} heat, regime propaganda (−2 world opinion)`; }
      grow(i, Math.min(BAL.rlCap, Math.round(10 * m))); MAP.p[i].a.forEach(j => grow(j, Math.round(3 * m))); const add = Math.round((3 + Math.floor(S.P[i].s / 8)) * m); S.supp += add; S.heat += 12;
      return `Rally in ${MAP.p[i].n}: +${add} supporters`; } },
  { id: 'strike', n: 'Strike', ph: 3, c: S => S.lead === 'commons' ? '$10K' : '$30K', can: () => S.wealth >= (S.lead === 'commons' ? 1 : 3), run() {
      S.wealth -= S.lead === 'commons' ? 1 : 3; S.strikeT = 2; S.heat += 8; return 'General strike: regime budget cut for 2 weeks'; } },
  { id: 'sab', n: 'Sabotage', ph: 3, c: 'needs a cell', can: i => cellsIn(i) > 0 && S.P[i].o === 'R', run(i) {
      const p = S.P[i]; const d = Math.max(0, Math.min(2 * MEN, p.g - MEN)); p.g -= d; S.heat += 10; return `Sabotage in ${MAP.p[i].n}: garrison −${d.toLocaleString('en')}`; } },
  { id: 'smug', n: 'Smuggle arms', ph: 3, c: 'risky', run() {
      const n = 4 + (S.powers.some(p => p.st !== 'Neutral' && p.st !== 'Hostile') ? 2 : 0); S.arms += n;
      if (rnd() < 0.3) { S.heat += 15; return `Smuggled ${n} arms, but a border post noticed (+15 heat)`; } return `Smuggled ${n} arms`; } },
  { id: 'militia', n: 'Raise militia', ph: 4, c: 'here: held, base or cell', can: i => S.arms >= 1 && S.supp >= 4 && (S.P[i].o === 'P' || i === S.home || cellsIn(i) > 0), run(i) {
      const n = Math.min(S.arms, Math.floor(S.supp / 4), 6); S.arms -= n; S.supp -= n * 2;
      const u = unitsAt(i, 'P').find(u => u.type === 'militia');
      if (u) u.str += n * MEN; else S.U.push({ id: S.nextId++, side: 'P', type: 'militia', p: i, str: n * MEN, reg: 0, mp: 2, path: [] });
      syncTotals(); return `Raised ${(n * MEN).toLocaleString('en')} militia in ${MAP.p[i].n} (armory caps it)`; } },
  { id: 'drill', n: 'Drill regulars', ph: 5, c: '500 militia here + $40K', can: i => S.wealth >= 4 && unitsAt(i, 'P').some(u => u.type === 'militia' && u.str >= 2 * MEN), run(i) {
      const u = unitsAt(i, 'P').find(u => u.type === 'militia' && u.str >= 2 * MEN); u.str -= 2 * MEN; u.reg += MEN; S.wealth -= 4; syncTotals(); return `Drilled ${MEN} regulars`; } },
];
function availableActions() { return ACTIONS.filter(a => S.phase >= a.ph); }
function canDo(a, i) { return !S.over && S.acts > 0 && (!a.can || a.can(i)); }
function doAction(a, i) {
  if (!canDo(a, i)) return null;
  S.acts--; const msg = a.run(i); if (i != null && i >= 0) aiNote(i); S.heat = clamp(S.heat, 0, 100); log(msg); oppAct(a.id); checkPhase(); return msg;
}

// ---- Countermeasure cards (CHANGE 9): abstract game stats only ----
const CARDS = [
  { id: 'enc', n: 'Encryption', cost: 6, skill: 8, d: 'comms sensor −60%' },
  { id: 'burn', n: 'Burner phones', cost: 4, skill: 4, d: 'CCTV −35%, comms −25%' },
  { id: 'cash', n: 'Cash only', cost: 5, skill: 4, d: 'finance sensor −70%' },
  { id: 'cell', n: 'Cell structure', cost: 8, skill: 12, d: 'compartmentalize: a busted cell exposes no links; informants −30%' },
];
function buyCard(id) {
  const c = CARDS.find(c => c.id === id); if (!c || S.cards[id] || S.wealth < c.cost || S.supp < c.skill) return false;
  S.wealth -= c.cost; S.cards[id] = 1; if (id === 'cell') S.cells.forEach(x => x.comp = true);
  log(`Countermeasure adopted: ${c.n}`); return true;
}
// Sensor coverage (0-100) in a province after countermeasures
const SENSORS = [['cctv', 'CCTV / facial rec.'], ['comms', 'Comms monitoring'], ['fin', 'Financial tracking'], ['inf', 'Informants']];
function sensorCov(i) {
  const sc = S.sc, u = S.P[i].urb, c = S.cards;
  return {
    cctv: sc * u * (c.burn ? 0.65 : 1),
    comms: sc * 0.85 * (0.5 + u / 2) * (c.enc ? 0.4 : 1) * (c.burn ? 0.75 : 1),
    fin: sc * 0.7 * (c.cash ? 0.3 : 1),
    inf: (35 + (100 - sc) * 0.35) * (c.cell ? 0.7 : 1),
  };
}
// Weekly detection chance = coverage × exposure × Fusion multiplier (CHANGE 9 + 10)
function exposure() { return clamp(0.15 + Math.log10(Math.max(0, S.supp) + 1) * 0.18 + S.heat / 250 + S.cells.length * 0.03 + (S.moveExp || 0), 0.1, 1.2); }
function detectChance() {
  const cov = sensorCov(S.home); const avg = (cov.cctv + cov.comms + cov.fin + cov.inf) / 400;
  const ch = avg * exposure() * (1 + 0.25 * S.fusion) * 0.8;
  return Number.isFinite(ch) ? clamp(ch, 0.02, 0.85) : 0.85; // guard: never let NaN switch detection off
}
function detectionRoll() {
  const ch = detectChance(), hit = rnd() < ch; S.last = { ch, hit, what: '' };
  if (!hit) { log(`Detection roll ${Math.round(ch * 100)}%: not detected`); return S.last; }
  const cov = sensorCov(S.home), tot = cov.cctv + cov.comms + cov.fin + cov.inf;
  let x = rnd() * tot, sensor = 'inf'; for (const k of ['cctv', 'comms', 'fin', 'inf']) { if ((x -= cov[k]) < 0) { sensor = k; break; } }
  S.heat = clamp(S.heat + 8 + Math.round(rnd() * 7), 0, 100);
  if (sensor === 'fin') { const l = Math.ceil(S.wealth * 0.3); S.wealth -= l; S.last.what = `finance trace: ${l} wealth frozen`; }
  else if ((sensor === 'cctv' || sensor === 'comms') && S.cells.length) { const c = S.cells[Math.floor(rnd() * S.cells.length)]; c.heat = clamp(c.heat + BAL.flagHeat, 0, 100); S.last.what = `${sensor === 'cctv' ? 'camera' : 'intercept'} trail: cell in ${MAP.p[c.p].n} heat +${BAL.flagHeat}`; }
  else if (S.arms > 2 && rnd() < 0.5) { const l = Math.ceil(S.arms * 0.4); S.arms -= l; S.last.what = `informant tip: cache raided, −${l} arms`; S.last.raid = 1; }
  else { const l = Math.max(1, Math.round(S.supp * 0.08)); S.supp = Math.max(0, S.supp - l); S.last.what = `informants: ${l} supporters arrested`; S.last.raid = 1; }
  log(`DETECTED (${SENSORS.find(s => s[0] === sensor)[1]}): ${S.last.what}`, 'bad'); return S.last;
}
// Link-exposure rule (CHANGE 10): a busted cell exposes its linked cells unless compartmentalized
function bustCell(k, sensor) {
  const gone = [k]; const c = S.cells[k];
  (S.arrests = S.arrests || []).push({ p: c.p, id: c.id, wk: S.week });          // drawn greyed + ARRESTED for 1 week
  if (!c.comp) S.cells.forEach((o, j) => { if (j !== k && !o.comp && (o.link === c.id || c.link === o.id) && rnd() < BAL.linkExpose) { gone.push(j); S.arrests.push({ p: o.p, id: o.id, wk: S.week }); } });
  const loss = gone.length * 3; S.supp = Math.max(1, S.supp - loss);
  const ids = gone.map(j => S.cells[j].id);
  S.cells = S.cells.filter((_, j) => !gone.includes(j)); S.cells.forEach(o => { if (ids.includes(o.link)) o.link = -1; });   // links to busted cells break
  S.last.bust = gone.length;
  return `${sensor === 'raid' ? 'raid' : sensor === 'cctv' ? 'camera match' : 'intercept'}: cell in ${MAP.p[c.p].n} rolled up` + (gone.length > 1 ? `, ${gone.length - 1} linked cell(s) exposed` : '') + ` (−${loss} supporters)`;
}

// ---- Regime AI: utility scoring over a threat map, limited by budget and its intel ----
function regimeTurn(diffNoise) {
  const out = [];
  const budget = Math.max(1, 1 + Math.floor(S.sc / 35) + (S.phase >= 3 ? 1 : 0) - (S.strikeT > 0 ? 1 : 0) - BAL.aiReplace);   // 0.9.0: the planned move replaces aiReplace of the old ad-hoc actions
  // what the regime BELIEVES (intel confidence = SC): it sees support blurred, only known cells
  const seen = S.P.map((p, i) => p.s * (0.4 + S.sc / 170) + S.cells.filter(c => c.p === i && c.known).length * 15 + (p.o === 'P' ? 60 : 0) + (adjHeld(i) ? 15 : 0));
  const cands = [];
  S.P.forEach((p, i) => {
    const t = seen[i] + rnd() * diffNoise;
    cands.push({ k: 'patrol', i, v: t * 0.5 + S.heat * 0.2 });
    if (p.s > 15) cands.push({ k: 'arrest', i, v: t * 0.8 });
    if (p.s > 20 && p.cur === 0) cands.push({ k: 'curfew', i, v: t * 0.6 });
    if (p.o === 'R' && S.phase >= 4 && adjHeld(i)) cands.push({ k: 'martial', i, v: t * 0.9 });
  });
  cands.push({ k: 'bureau', i: -1, v: avgSupport() * 3 });
  cands.sort((a, b) => b.v - a.v);
  const used = new Set();
  for (const c of cands) {
    if (out.length >= budget) break; if (used.has(c.k + c.i) || used.has(c.k)) continue; used.add(c.k + c.i); if (c.k === 'bureau' || c.k === 'counter') used.add(c.k);
    const p = S.P[c.i], nm = c.i >= 0 ? MAP.p[c.i].n : '';
    let msg = '';
    if (c.k === 'patrol') { S.heat += 3 + (cellsIn(c.i) ? 3 : 0); msg = `Patrols in ${nm}`; }
    if (c.k === 'arrest') persHitBacked(c.i);                          // crackdowns hit the factions you back
    if (c.k === 'arrest') { const l = Math.max(1, Math.round(S.supp * 0.05)); S.supp = Math.max(1, S.supp - l); p.s = Math.max(0, p.s - 5); msg = `Arrests in ${nm}: −${l} supporters`; }
    if (c.k === 'curfew') { p.cur = 2; msg = `Curfew in ${nm}: support frozen 2 weeks`; }
    if (c.k === 'martial') { p.g = Math.ceil(p.g * 1.5); msg = `Martial law in ${nm}: garrison ${p.g}`; }
    if (c.k === 'bureau') {   // cells push back: propaganda is halved where you have one
      S.P.forEach((q, j) => { const half = cellsIn(j) > 0; q.s = Math.max(0, q.s - (half ? 1 : 2)); if (half) (S.bureau = S.bureau || []).push(j); });
      msg = 'Propaganda Bureau: support −2% everywhere (−1% where you have a cell)'; }
    // Overreach: a harsh crackdown where support is high backfires
    if ((c.k === 'arrest' || c.k === 'martial') && rnd() < BAL.gvSpawn) gvAdd(c.i, c.k === 'arrest' ? 'killing' : 'martial');   // repression backfires
    if ((c.k === 'arrest' || c.k === 'martial') && p.s > 40) { p.s = Math.min(100, p.s + 5); msg += ' · OVERREACH: locals rally (+5%)'; }
    out.push(msg); log(msg, 'reg');
  }
  // reinforcement: budget slowly refills weak garrisons
  if (S.week % 2 === 0) { const w = S.P.filter(p => p.o === 'R').sort((a, b) => a.g - b.g)[0]; if (w && reinforce()) { w.g += Math.round(MEN * BAL.regime * gm('reinf', 1)); w.rf = 1; } }
  return out;
}

// ---- Foreign powers: Hostile / Neutral / Backer / Ally (adapted from Ash Hollow diplomacy) ----
function askBacking(k) {
  const p = S.powers[k]; S.acts--;
  const d = Math.round(6 + avgSupport() / 4 + held() * 3 - S.heat / 10 + rnd() * 6);
  p.rel = clamp(p.rel + d, -100, 100); const was = p.st; p.st = stateOf(p.rel);
  log(`${p.n}: envoy asked for backing (relation ${d >= 0 ? '+' : ''}${d})` + (was !== p.st ? ` → now ${p.st}` : ''));
  return d > 0;
}
function proposeAlliance(k) {
  const p = S.powers[k]; S.acts--;
  if (p.rel >= 55 && S.phase >= 4) { p.rel = Math.max(p.rel, 60); p.st = 'Ally'; p.pact = { w: S.week, due: S.week + BAL.pactCallEvery }; S.pactNew = 1; giveRegulars(3 * MEN); log(`${p.n} signs an alliance and sends 750 regulars`, 'good'); return true; }
  p.rel -= 5; log(`${p.n} refuses an alliance for now`); return false;
}
function ceasefire(k) {
  const p = S.powers[k];
  if (!(p.st === 'Backer' || p.st === 'Ally') || S.ceaseCd > 0 || S.phase < 4) return false;
  S.acts--; S.cease = 3; S.ceaseCd = 8; S.heat = Math.max(0, S.heat - 10);
  log(`${p.n} brokers a 3-week ceasefire`, 'good'); checkEnd(); return true;
}

// ---- 0.6.2 foreign deals: a power at Neutral or better sometimes offers aid, an envoy or recognition, and asks for something back.
// Accept: +dealAcc stance and both sides apply. Refuse: −dealRef. Unanswered for dealWeeks: lapses, −dealLapse.
// A Hostile power may instead pay the regime (reserves +regAid). Puppet Regime's +10 opinion (govStart) lifts every stance.
const DEAL_GIVE = {
  loyal: { t: () => 'Pact honoured', run() {} },   // 0.8.0 pact call: the price is the 'want'; refusing breaks the pact obligation
  cash:  { t: () => `Aid ${usd(BAL.dealCash)}`, run() { S.wealth += BAL.dealCash; } },
  arms:  { t: () => `${BAL.dealArms} arms`, run() { S.arms += BAL.dealArms; } },
  envoy: { t: () => `Envoy: −${BAL.envoyHeat} heat`, run() { S.heat = Math.max(0, S.heat - BAL.envoyHeat); } },
  info:  { t: () => 'Wipe police intel', run() { S.cells.forEach(c => c.known = false); } },
  recog: { t: () => `Recognition +${BAL.recogSupp}%`, run() { S.P.forEach((p, i) => grow(i, BAL.recogSupp)); } },
};
const DEAL_WANT = {
  arms:  { t: () => 'Send 1 arms', run() { S.arms = Math.max(0, S.arms - 1); } },
  heat:  { t: () => `Thanks: +${BAL.wantHeat} heat`, run() { S.heat += BAL.wantHeat; } },
  cash:  { t: () => `A cut: ${usd(BAL.wantCash)}`, run() { S.wealth -= BAL.wantCash; } },
  rival: { t: k => `Snub ${S.powers[1 - k] ? S.powers[1 - k].n : 'rival'} (−${BAL.wantRival})`, run(k) { const q = S.powers[1 - k]; if (q) { q.rel = clamp(q.rel - BAL.wantRival, -100, 100); q.st = stateOf(q.rel); } } },
};
function dealTick(rep) {
  S.powers.forEach((p, k) => {
    if (p.deal && S.week - p.deal.w >= BAL.dealWeeks) { p.rel = clamp(p.rel - (p.deal.call ? BAL.pactBreak : BAL.dealLapse), -100, 100); p.st = stateOf(p.rel); log(`${p.n}'s offer lapsed`); if (rep) rep.stance = -1; p.deal = null; }
    pactCheck(p); if (p.pact && !p.deal && S.week >= p.pact.due) { p.pact.due = S.week + BAL.pactCallEvery; p.deal = { g: 'loyal', x: rnd() < 0.5 ? 'cash' : 'arms', w: S.week, call: 1 }; log(`${p.n} calls on the pact (Powers tab)`); if (rep) rep.dealNew = 1; return; }
    if (S.phase < 3) return;
    if (p.st === 'Hostile') { if (rnd() < BAL.regAidChance) { S.R.reserves += BAL.regAid; log(`${p.n} sends aid to the regime`, 'bad'); } return; }
    if (p.deal || rnd() >= BAL.dealChance) return;
    const G = Object.keys(DEAL_GIVE), W = Object.keys(DEAL_WANT);
    p.deal = { g: G[Math.floor(rnd() * G.length)], x: W[Math.floor(rnd() * W.length)], w: S.week };
    log(`${p.n} offers a deal (Powers tab)`, 'good'); if (rep) rep.dealNew = 1;
  });
}
function answerDeal(k, yes) {
  const p = S.powers[k], d = p && p.deal; if (!d) return false; p.deal = null;
  if (d.call && !yes) { p.rel = clamp(p.rel - BAL.pactBreak, -100, 100); log(`You broke your pact obligation to ${p.n} (−${BAL.pactBreak})`, 'bad');
    p.st = stateOf(p.rel); pactCheck(p); return false; }   // 0.8.1: stance below 60 (stateOf) ends Ally and the pact; the old 40 hysteresis is gone
  if (yes) { DEAL_GIVE[d.g].run(k); DEAL_WANT[d.x].run(k); p.rel = clamp(p.rel + BAL.dealAcc, -100, 100); log(`Deal with ${p.n}: ${DEAL_GIVE[d.g].t(k)} for ${DEAL_WANT[d.x].t(k)}`, 'good'); }
  else { p.rel = clamp(p.rel - BAL.dealRef, -100, 100); log(`You refused ${p.n}'s offer`); }
  p.st = stateOf(p.rel); pactCheck(p); return yes;
}

// ---- 0.7.0 play on after the revolt: Hostile powers sanction you and may invade from a border; survive afterWeeks ----
// sanc: [{k: oil|banks|trade|arms, from}] each drains BAL.sancBite[k] wealth (arms: arms) a week while that power stays Hostile.
// inv: {from, p: border province, str, prog 0..1}: advances 1/invWeeks a week toward the capital unless your fighters outnumber it.
function afterEnsure(s = S) { s.after = s.after || { wk: 0, sanc: [], inv: null, lvl: 'calm', fell: false, nInv: 0, nSanc: 0 }; return s.after; }
function threatOf() { const A = S.after; return A.inv ? 'war' : A.sanc.length || S.powers.some(p => p.st === 'Hostile') ? 'tense' : 'calm'; }
function myFighters() { return S.U.filter(u => u.side === 'P').reduce((a, u) => a + u.str, 0); }
function afterTick(rep) {
  const A = afterEnsure(); A.wk++;
  if (A.wk === 1) { const p = S.powers.slice().sort((a, b) => a.rel - b.rel)[0];   // the least friendly power turns on the new state (an Ally never does)
    if (p && p.st !== 'Ally') { p.rel = Math.min(p.rel - BAL.afterHarden, -45); p.st = 'Hostile'; log(`${p.n} refuses to recognise the new government`, 'bad'); } }
  A.sanc = A.sanc.filter(s => { const p = S.powers.find(p => p.n === s.from); return p && p.st === 'Hostile'; });   // sanctions lift when a power softens
  S.powers.forEach(p => { if (p.st !== 'Hostile') return;
    if (A.sanc.length < BAL.sancMax && rnd() < BAL.sancChance) { const K = Object.keys(BAL.sancBite).filter(k => !A.sanc.some(s => s.k === k)), k = K[Math.floor(rnd() * K.length)];
      if (k) { A.sanc.push({ k, from: p.n }); rep.sanc = k; A.nSanc = (A.nSanc || 0) + 1; log(`${p.n} imposes a ${k} embargo`, 'bad'); } }
    if (!A.inv && rnd() < BAL.invChance) { const far = S.P.map((q, i) => i).filter(i => i !== MAP.cap.p).sort((a, b) => Math.hypot(MAP.p[b].c[0] - MAP.p[MAP.cap.p].c[0], MAP.p[b].c[1] - MAP.p[MAP.cap.p].c[1]) - Math.hypot(MAP.p[a].c[0] - MAP.p[MAP.cap.p].c[0], MAP.p[a].c[1] - MAP.p[MAP.cap.p].c[1]));
      const from = far[Math.floor(rnd() * Math.min(3, far.length))]; A.inv = { from: p.n, p: from, path: invPath(from), str: BAL.invStr * MEN, prog: 0 }; rep.inv = 1; A.nInv = (A.nInv || 0) + 1; log(`${p.n} invades across the border at ${MAP.p[from].n}!`, 'bad'); } });
  A.sanc.forEach(s => { if (s.k === 'arms') S.arms = Math.max(0, S.arms - BAL.sancBite.arms); else S.wealth -= BAL.sancBite[s.k]; });
  const allies = S.powers.filter(p => p.pact);
  allies.forEach(p => { if (A.sanc.length && rnd() < BAL.pactLift) { const s = A.sanc.shift(); log(`${p.n} gets the ${s.k} embargo lifted`, 'good'); } });
  if (S.wealth < 0) { const L = S.P.map((q, i) => i).filter(i => S.P[i].o === 'P' && (i !== MAP.cap.p || held() <= BAL.unrestKeepCap)).sort((a, b) => S.P[a].s - S.P[b].s);   // Director: below $0 after the revolt, lose 1 province a week
    if (L.length) { const i = L[0]; S.P[i].o = 'R'; S.P[i].g = MEN; rep.unrest = 1; log(`Unpaid and angry: ${MAP.p[i].n} is lost to unrest (wealth below $0)`, 'bad'); } }
  if (A.inv) { const I = A.inv, mine = myFighters() + allies.length * BAL.pactTroops * MEN;   // allies send troops under the pact
    if (mine >= I.str) { I.str -= Math.round(mine * BAL.invDef); log(`Your forces hold the invaders from ${I.from} (${Math.max(0, I.str).toLocaleString('en')} left)`, 'good'); }
    else { I.prog = Math.min(1, I.prog + 1 / BAL.invWeeks); log(`Invasion from ${I.from}: ${Math.round(I.prog * 100)}% of the way to ${MAP.cap.n}`, 'bad'); }
    if (I.str <= 0) { log(`The invasion from ${I.from} is thrown back`, 'good'); A.inv = null; }
    else if (I.prog >= 1) A.fell = true; }
  const lv = threatOf(); if (lv !== A.lvl) { A.lvl = lv; rep.threat = lv; }
}

// ---- 0.9.0 regime plan: one announced move a week, picked by threat, carried out the next End Week ----
// raid    = hunt the cell with the most heat/exposure (its arrest chance ×aiRaidMul next week)
// dig     = reinforce the regime province most likely to fall (+aiDig×250, dug in)
// crack   = support is rising: crackdown in the highest-support province (−aiCrack%)
// propaganda = support is flat/falling: propaganda and payoffs (−aiProp% everywhere, halved where you have a cell)
// attack  = counter-attack the weakest rebel province next to a garrison bigger than aiCounter× its defenders
// Guard: a province you act in aiGuardHits+ times (decaying ×aiHitDecay a week) is watched: actions there cost +aiGuardHeat heat.
function aiEnsure(s = S) { s.ai = s.ai || { plan: null, hits: {}, suppWas: null }; return s.ai; }
function aiNote(i) { const A = aiEnsure(); A.hits[i] = (A.hits[i] || 0) + 1; if (A.hits[i] >= BAL.aiGuardHits) { S.heat += BAL.aiGuardHeat; if (A.hits[i] === BAL.aiGuardHits) log(`The regime is watching ${MAP.p[i].n} closely now`, 'reg'); } }
function defOf(i) { return S.U.filter(u => u.side === 'P' && u.p === i).reduce((a, u) => a + u.str, 0); }
function aiPlan(rep) {
  const A = aiEnsure(), sup = avgSupport(), trend = A.suppWas == null ? 0 : sup - A.suppWas; A.suppWas = sup; const C = [];
  for (const k in A.hits) { A.hits[k] *= BAL.aiHitDecay; if (A.hits[k] < 0.5) delete A.hits[k]; }
  const hot = S.cells.slice().sort((a, b) => (b.heat + (b.known ? 30 : 0)) - (a.heat + (a.known ? 30 : 0)))[0];
  if (hot) C.push({ k: 'raid', p: hot.p, cell: hot.id, v: hot.heat + (hot.known ? 30 : 0) });
  S.P.forEach((p, i) => { if (p.o !== 'R' || !adjHeld(i)) return; const thr = MAP.p[i].a.reduce((a, j) => a + defOf(j), 0) / Math.max(MEN, p.g);
    C.push({ k: 'dig', p: i, v: 20 + thr * 25 }); });
  if (S.phase >= 4) S.P.forEach((p, i) => { if (p.o !== 'P' || i === S.home) return; const g = Math.max(0, ...MAP.p[i].a.filter(j => S.P[j].o === 'R').map(j => S.P[j].g));
    if (g > BAL.aiCounter * defOf(i)) C.push({ k: 'attack', p: i, v: 45 + Math.min(40, g / Math.max(MEN, defOf(i)) * 5) }); });
  const top = S.P.map((p, i) => i).filter(i => S.P[i].o === 'R').sort((a, b) => S.P[b].s - S.P[a].s)[0];
  if (trend > 0 && top != null) C.push({ k: 'crack', p: top, v: 25 + trend * 20 + S.P[top].s / 4 }); else C.push({ k: 'propaganda', p: S.home, v: 20 + sup / 2 });
  C.sort((a, b) => b.v - a.v); A.plan = C[0] ? { k: C[0].k, p: C[0].p, cell: C[0].cell, w: S.week } : null; rep.intent = A.plan;
}
function intentKnown(i) { return cellsIn(i) > 0 || S.P[i].s > 50 || S.P[i].o === 'P'; }   // fog: informants (a cell), support > 50, or your own land
function intentText(pl) { if (!pl) return 'The regime is quiet'; const n = MAP.p[pl.p].n;
  if (pl.k !== 'propaganda' && !intentKnown(pl.p)) return 'Unknown regime move';   // propaganda is public
  return { raid: `The regime is hunting your cell in ${n}`, dig: `The regime is moving troops to ${n}`, crack: `The regime plans a crackdown in ${n}`, propaganda: 'The regime is buying loyalty with propaganda and payoffs', attack: `The regime is massing to retake ${n}` }[pl.k]; }
function aiExecute() {
  const A = aiEnsure(), pl = A.plan; if (!pl) return ''; const p = S.P[pl.p], n = MAP.p[pl.p].n; let m = '';
  if (pl.k === 'dig' && p.o === 'R') { p.g += Math.round(BAL.aiDig * MEN); p.rf = 1; m = `Regime troops arrive in ${n}`; }
  if (pl.k === 'crack') { p.s = Math.max(0, p.s - BAL.aiCrack); m = `Crackdown in ${n}: support −${BAL.aiCrack}%`; if (p.s > 40 && rnd() < BAL.gvSpawn) gvAdd(pl.p, 'killing'); }
  if (pl.k === 'propaganda') { S.P.forEach((q, j) => q.s = Math.max(0, q.s - Math.floor(cellsIn(j) ? BAL.aiProp / 2 : BAL.aiProp))); m = `Propaganda and payoffs: support −${BAL.aiProp}%`; }
  if (pl.k === 'attack' && p.o === 'P') { const g = Math.max(0, ...MAP.p[pl.p].a.filter(j => S.P[j].o === 'R').map(j => S.P[j].g));
    if (!defOf(pl.p) && g > 0) { p.o = 'R'; p.g = Math.round(g * BAL.aiCounterTake); m = `Regime counter-attack retakes undefended ${n}`; }   // only empty provinces fall; defended ones bleed
    else if (g > BAL.aiCounter * defOf(pl.p)) { S.U.filter(u => u.side === 'P' && u.p === pl.p).forEach(u => u.str = Math.round(u.str * (1 - BAL.aiCounterLoss))); m = `Regime counter-attack on ${n}: your defenders lose ${Math.round(BAL.aiCounterLoss * 100)}%`; }
    else m = `Regime counter-attack on ${n} called off: you reinforced it`; }
  if (pl.k === 'raid') m = `Police sweep for your cell in ${n}`;
  if (m) log(m, 'reg'); return m;
}
// Factions and hostile powers react to who is winning: you weak → hardliners firm up and hostile powers pay the regime more;
// you winning → moderates waver and neutral powers drift your way (bandwagon).
function aiSide(rep) {
  if (!S.fac) return; const weak = S.phase >= 4 ? held() <= 1 : avgSupport() < 10, win = held() >= Math.ceil(S.P.length / 3);
  if (weak) { S.fac.hardliners = clamp(S.fac.hardliners + BAL.aiFacSwing, -100, 100); S.powers.forEach(p => { if (p.st === 'Hostile' && rnd() < BAL.regAidChance * (BAL.aiWeakAid - 1)) S.R.reserves += BAL.regAid; }); }
  if (win) { S.fac.moderates = clamp(S.fac.moderates - BAL.aiFacSwing, -100, 100); S.powers.forEach(p => { if (p.st === 'Neutral') { p.rel = clamp(p.rel + BAL.aiBandwagon, -100, 100); p.st = stateOf(p.rel); } }); }
}

// ---- 0.8.0 alliances + economy ----
// Pact: signing an alliance (proposeAlliance) makes a mutual-defence pact. Every pactCallEvery weeks the ally calls on it (a deal card:
// pay pactCallCash or send 1 arms); refusing or ignoring it costs pactBreak stance. The pact ends when the power drops below Ally.
// In war it sends pactTroops×250 against an invasion and may lift one sanction a week (pactLift).
function pactCheck(p) { if (p.pact && p.st !== 'Ally') { p.pact = null; if (p.deal && p.deal.call) p.deal = null; S.pactBroken = 1; log(`The pact with ${p.n} has ended`, 'bad'); } }
// Trade routes: before the revolt only Backer/Ally powers trade with you; after it, every power that isn't Hostile, unless a trade embargo is on. Each pays tradeVal a week.
function tradeRoutes() { const emb = S.after && S.after.sanc.some(s => s.k === 'trade'); return emb ? [] : S.powers.filter(p => S.won ? p.st !== 'Hostile' : p.st === 'Backer' || p.st === 'Ally'); }
// Shortages 0-3: food rises with fighting or a trade embargo, fuel with an oil embargo or no trade at all; each falls 1 in a quiet week.
// Each level costs shortSupp support a week in your held provinces.
function shortTick(rep) {
  const sh = S.short = S.short || { food: 0, fuel: 0 }, emb = k => S.after && S.after.sanc.some(s => s.k === k), was = sh.food + sh.fuel;
  const up = { food: S.fightsWk > 0 || emb('trade'), fuel: emb('oil') || (S.won && !tradeRoutes().length) };
  for (const k in up) sh[k] = clamp(sh[k] + (up[k] ? BAL.shortUp : -1), 0, 3);
  if (sh.food + sh.fuel > was && was === 0) rep.short = 1;
  const hit = (sh.food + sh.fuel) * BAL.shortSupp; if (hit) S.P.forEach((p, i) => { if (p.o === 'P') grow(i, -Math.round(hit)); });
}
// Path for an invasion: shortest province path from the border province to the capital (it advances along real provinces)
function invPath(from) {
  const prev = new Map([[from, -1]]), q = [from];
  while (q.length) { const i = q.shift(); if (i === MAP.cap.p) break; for (const j of MAP.p[i].a) if (!prev.has(j)) { prev.set(j, i); q.push(j); } }
  const path = []; for (let i = MAP.cap.p; i !== -1 && i !== undefined; i = prev.get(i)) path.unshift(i); return path[0] === from ? path : [from, MAP.cap.p];
}

// ---- phases, win and lose ----
function checkPhase() {
  const before = S.phase, cnt = th => S.P.filter(p => p.s >= th).length;
  if (S.phase === 1 && S.supp >= 10) S.phase = 2;
  if (S.phase === 2 && cnt(25) >= 2) S.phase = 3;
  if (S.phase === 3 && (cnt(40) >= 4 || S.heat >= 100)) { S.phase = 4; S.uprisingWeek = S.week; S.zeroWk = 0; if (S.heat >= 100) { S.heat = 60; log('Heat boiled over: forced early uprising!', 'bad'); } S.esc = Math.max(S.esc, 1); }
  if (S.phase === 4 && held() >= 3) { S.phase = 5; S.esc = Math.max(S.esc, 2); }
  if (S.phase !== before) { S.acts = Math.max(S.acts, 0); log(`PHASE ${S.phase}: ${PHASES[S.phase]}`, 'good'); }
  return S.phase !== before;
}
function checkEnd() {
  if (S.over) return S.over;
  const n = S.P.length;
  if (S.phase <= 2 && S.heat >= 100) S.over = { k: 'arrested', t: 'You were arrested. Heat reached 100 before the movement could protect you.' };
  else if (S.phase >= 4 && (S.zeroWk || 0) >= 8) S.over = { k: 'lose', t: 'You held no provinces for 8 straight weeks. The uprising is crushed.' };
  else if (S.neg >= 3 && !S.won) S.over = { k: 'lose', t: 'Wealth stayed below zero for 3 weeks. The movement fell apart.' };
  if (held() > 0) S.everHeld = true;
  if (S.won && !S.over && S.after) {   // 0.7.0: after the revolt the clear end is surviving afterWeeks, or losing the capital
    if (S.after.fell) S.over = { k: 'lose', t: `${MAP.cap.n} fell to the invaders. The new government is gone.` };
    else if (S.after.wk >= BAL.afterWeeks) S.over = { k: 'survived', t: `Your new government survived ${BAL.afterWeeks} weeks after the revolt.` };
  }
  if (!S.won && !S.over) {
    const capital = S.P[MAP.cap.p].o === 'P' && held() >= Math.ceil(n * 7 / 16); // capital + 7 of 16
    const collapse = S.phase >= 4 && S.U.filter(u => u.side !== 'P').reduce((a, u) => a + u.str, 0) <= 0; // regime army gone
    const settle = S.cease > 0 && avgSupport() >= 70 && S.powers.some(p => p.st === 'Ally');
    if (capital || settle || collapse) { S.won = true; S.winNew = capital ? 'capital' : collapse ? 'collapse' : 'settlement'; log(capital ? `Capital ${MAP.cap.n} taken. The regime has fallen!` : collapse ? 'The regime army has collapsed. The regime has fallen!' : 'Negotiated Settlement signed. The regime steps down.', 'good'); }
  }
  return S.over;
}

// ---- End Week: income, regime, detection, diplomacy drift ----
function endWeek(diffNoise) {
  const rep = { reg: [], det: null, phase: false, moves: [], fights: [], eco: [], defect: 0 };
  if (!S.R.base) regimeStart(S);
  S.heat = Math.max(0, S.heat + gm('heatWk', 0));   // 0.6.1: surveillance states run a little hotter
  const was = S.season; S.season = seasonOf(S.week); S.weather = rollWeather(); rep.season = S.season !== was ? S.season : null; rep.weather = S.weather;
  if (isWinter()) rep.eco.push('Winter → every move costs +1, supply reaches only 1 province');
  else if (isMud()) rep.eco.push('Mud season → regime Army stuck to roads (plains and cities)');
  S.arrests = []; S.bureau = []; S.cells.forEach(c => c.h0 = c.heat || 0);   // arrest odds use the heat the week started with
  unitPhase(rep); outputTick(rep); regimeEcon(rep); cellTick(rep);
  // supporters grow from support where you have cells (and the home base)
  let gain = 0; S.P.forEach((p, i) => { gain += p.s * ((i === S.home ? 1 : 0) + (p.o === 'P' ? 1.5 : 0)) / 60; });   // cells pay flat amounts in cellTick
  const boost = Math.min(ECO.inflRecruit, S.R.infl / 60);              // inflation: up to +30% recruiting
  S.supp += Math.floor(gain * (1 + boost)); if (boost >= 0.05) rep.eco.push(`Inflation ${Math.round(S.R.infl)}% → recruiting +${Math.round(boost * 100)}%`);
  // wealth: donations + taxes in held provinces + backers − upkeep
  const B = rebelBudget(); let w = B.net; S.why.wealth = B.why;
  S.powers.forEach(p => { if (p.st === 'Backer') S.arms += 1; if (p.st === 'Ally') S.arms += 2; if (p.st === 'Hostile') { const q = S.P.find(q => q.o === 'R'); if (q && reinforce()) { q.g += MEN; q.rf = 1; } } });
  S.wealth += w; S.neg = S.wealth < 0 ? S.neg + 1 : 0;
  // held provinces slowly gain support; curfews tick down
  S.P.forEach(p => { if (p.o === 'P') p.s = Math.min(100, p.s + 2); if (p.cur > 0) p.cur--; });
  momentum();
  rep.reg = S.cease > 0 ? ['Ceasefire holds: no regime offensives'] : regimeTurn(diffNoise);
  if (S.cease <= 0) { const m = aiExecute(); if (m) rep.reg.push(m); }   // 0.9.0: last week's announced plan happens now
  rep.det = detectionRoll(); S.moveExp = 0;
  if (rep.det.hit && S.cells.length) S.cells[Math.floor(rnd() * S.cells.length)].known = true;
  // Fusion Level 0-3 (CHANGE 10): the regime's contractor links its sensors over time
  const f = clamp(Math.floor((S.week + S.sc / 4) / 14), 0, S.sc > 60 ? 3 : S.sc > 35 ? 2 : 1);
  if (f > S.fusion) { S.fusion = f; log(`Corvid Lattice fusion upgrade: Fusion Level ${f}`, 'reg'); }
  // power relations drift with your national support
  S.powers.forEach(p => { p.rel = clamp(p.rel + (avgSupport() > 30 ? 1 : -1), -100, 100); p.st = stateOf(p.rel); });
  aiSide(rep); dealTick(rep); shortTick(rep); if (S.won && !S.over) afterTick(rep);
  aiPlan(rep);   // 0.9.0: choose next week's move (shown as the intent line)
  if (S.pactNew) { rep.pactNew = 1; S.pactNew = 0; } if (S.pactBroken) { rep.pactBroken = 1; S.pactBroken = 0; }
  { const B = rebelBudget(); rep.trade = B.trade; rep.budgetLow = S.wealth + B.net * BAL.budgetLowWk < 0 && B.net < 0; S.lastBudget = { inc: B.inc, up: B.up, trade: B.trade, sanc: B.sanc, net: B.net - B.sanc }; }
  if (S.cease > 0) S.cease--; if (S.ceaseCd > 0) S.ceaseCd--; if (S.strikeT > 0) S.strikeT--;
  S.heat = clamp(S.heat - 3, 0, 100);
  // loss counter: +1 per End Week with 0 held provinces in phase 4+ (here, so it can't double-count)
  if (S.phase >= 4) S.zeroWk = held() === 0 ? (S.zeroWk || 0) + 1 : 0;
  // dug in: count the weeks the regime has held each province with troops (lost or empty = start over)
  S.P.forEach(p => { if (p.o === 'R' && p.g > 0) p.hw = (p.hw || 0) + 1; else { p.hw = 0; p.rf = 0; } });
  S.week++; S.acts = S.phase >= 3 ? 3 : 2; S.reinf = 0;
  gvTick(rep);                                                         // 0.5.0a grievance cards
  oppTick(rep);                                                        // 0.5.4 opposition factions
  regimeResponse(rep);                                                 // 0.4.0: threat → factions → rung → effects
  rep.arrests = S.arrests; rep.phase = checkPhase(); checkEnd();
  return rep;
}

// Momentum (0.2.1h): held land recruits, and 3+ held provinces stretch the regime thin
function momentum() {
  S.P.forEach((p, i) => {
    if (p.o !== 'P' || S.week % (S.week <= BAL.earlyWeeks ? BAL.recruitEarly : BAL.recruitEvery)) return;   // every 3 weeks early on, then every 12
    const u = unitsAt(i, 'P').find(u => u.type === 'militia');           // +1 recruit joins the local militia
    if (u) u.str += BAL.recruit * MEN; else S.U.push({ id: S.nextId++, side: 'P', type: 'militia', p: i, str: BAL.recruit * MEN, reg: 0, mp: 2, path: [] });
  });
  if (held() >= BAL.spreadAt) S.P.forEach((p, i) => {
    if (p.o === 'P' || !adjHeld(i)) return;
    p.s = Math.min(100, p.s + BAL.spreadSupp);                            // ideas spread across the border
    if (p.g > MEN) p.g = Math.max(MEN, Math.round(p.g * (1 - BAL.thin)));   // garrison spread thin (real heads, so 7% counts)
  });
  syncTotals();
}

// Where may a cell go? Home, held land, or right next to them.
const cellSpot = i => i === S.home || S.P[i].o === 'P' || MAP.p[i].a.some(j => j === S.home || S.P[j].o === 'P');
// Weekly arrest chance for one cell, from its heat at the start of the week; going dark halves it
function arrestChance(c) { const h = c.h0 ?? c.heat ?? 0, b = h < 30 ? BAL.arrestLo : h < 70 ? BAL.arrestMid : BAL.arrestHi; return (c.dark ? b / 2 : b) * gm('arrest', 1) * (S.ai && S.ai.plan && S.ai.plan.k === 'raid' && S.ai.plan.cell === c.id ? BAL.aiRaidMul : 1); }   // 0.9.0: a planned raid
// Cells at work: pay off (if awake), heat up or cool down, then roll for arrest
function cellTick(rep) {
  rep.cells = [];
  for (const c of [...S.cells]) {
    if (c.heat == null) c.heat = 0;
    if (c.dark) { c.heat = Math.max(0, c.heat - BAL.darkCool); continue; }
    const p = S.P[c.p], before = p.s;
    if (p.s < BAL.cellCap) grow(c.p, Math.min(BAL.cellSupp, BAL.cellCap - p.s));   // grow() does nothing under curfew
    const got = p.s - before;
    S.recruits = (S.recruits || 0) + BAL.cellRecruits;                              // people; every full supporter point converts
    const per = S.C.pop / 10000; while (S.recruits >= per) { S.recruits -= per; S.supp++; }
    S.cash = (S.cash || 0) + BAL.cellCash; while (S.cash >= 1) { S.cash -= 1; S.wealth++; }   // $2K a week adds up to $10K points
    c.heat = clamp(c.heat + BAL.cellHeat, 0, 100); S.cellGain = (S.cellGain || 0) + got;
    rep.cells.push({ p: c.p, s: got, h: BAL.cellHeat, r: BAL.cellRecruits });
    log(`Cell in ${MAP.p[c.p].n}: ${got ? '+' + got + '% support' : p.cur ? 'curfew, no growth' : 'support at cap'}, +${BAL.cellRecruits} recruits, +$${BAL.cellCash * 10}K, +${BAL.cellHeat} heat`);
  }
  for (const c of [...S.cells]) {                                                 // arrest rolls
    const k = S.cells.indexOf(c); if (k < 0) continue;
    if (rnd() < arrestChance(c)) { S.last = S.last || {}; log(`ARRESTED: ${bustCell(k, 'raid')}`, 'bad'); rep.bust = 1; }
  }
}

// ================= ECONOMY (CHANGE 12 + 15) =================
// Donations (0.3.0b). Think of a ramp: at donFull supporters (120) you get the old payout, 120/12 = 10 points.
// Below that, (supp / 120) is how far up the ramp you are (0 to 1). We raise it to donExp (1 = straight ramp,
// bigger = slow start) and multiply by 10. Math.ceil rounds UP, so even 1 supporter gives 1 point ($10K).
// From 120 up, it is exactly the old rule: 1 point per 12 supporters.
function donations(supp) {
  const full = ECO.donFull / 12;                                   // the payout at donFull supporters
  if (supp <= 0) return 0;
  if (supp >= ECO.donFull) return Math.floor(supp / 12);
  return Math.ceil(full * Math.pow(supp / ECO.donFull, ECO.donExp));
}
// Rebel money for next week, line by line, so the UI can show WHY wealth changes.
function rebelBudget() {
  const don = donations(S.supp);
  const tax = Math.round(S.P.reduce((a, p) => a + (p.o === 'P' ? 3 * p.out / 100 : 0), 0));   // taxes scale with output
  const aid = S.powers.reduce((a, p) => a + (p.st === 'Backer' ? 3 : p.st === 'Ally' ? 5 : 0), 0);
  const trade = tradeRoutes().length * BAL.tradeVal;                                          // 0.8.0: open trade routes
  let inc = don + tax + aid + trade; inc = Math.round(inc * (1 + held() * BAL.income));               // +5% per held province
  const up = Math.ceil(S.militia / MEN * 0.5 + S.regulars / MEN);                              // pay 0.5 per 250 militia, 1 per 250 regulars
  const sanc = S.after ? S.after.sanc.reduce((a, s) => a + (s.k === 'arms' ? 0 : BAL.sancBite[s.k]), 0) : 0;   // embargoes, shown in the breakdown
  const why = `donations ${usd(don)} + taxes ${usd(tax)} + aid ${usd(aid)} + trade ${usd(trade)} (+${Math.round(held() * BAL.income * 100)}%) − upkeep ${usd(up)}`;
  return { don, tax, aid, trade, sanc, inc, up, net: inc - up, why };
}
// Money warning: amber when upkeep reaches 80% of income, red when it's higher. Returns null when safe.
function upkeepWarning() {
  const B = rebelBudget(); if (B.up === 0 || B.up < B.inc * ECO.upkeepWarn) return null;
  const left = B.net < 0 ? Math.max(0, Math.floor(S.wealth / -B.net)) : null;
  return { lvl: B.net < 0 ? 'red' : 'amber', B, t: B.net < 0 ? `Upkeep ${usd(B.up)} > income ${usd(B.inc)}: broke in ${left} week(s)` : `Upkeep ${usd(B.up)} is ${Math.round(B.up / Math.max(1, B.inc) * 100)}% of income ${usd(B.inc)}` };
}
// Province output: fighting knocks it down 15%, quiet weeks bring back 5%
function outputTick(rep) {
  const hit = new Set(rep.fights.map(f => f.p));
  S.P.forEach((p, i) => { if (hit.has(i)) { p.out = Math.max(20, p.out - ECO.fightOut); rep.eco.push(`Fighting in ${MAP.p[i].n} → output −${ECO.fightOut}% (now ${p.out}%)`); } else p.out = Math.min(100, p.out + ECO.quietOut); });
}
// Regime budget lines: income first pays army, police and debt; what's left is subsidies.
function regimeEcon(rep) {
  const R = S.R, sum = t => S.U.filter(u => u.side === 'R' && u.type === t).reduce((a, u) => a + u.str, 0) / MEN;
  const out = S.P.reduce((a, p) => a + (p.o === 'R' ? p.out : 0), 0) / S.P.length / 100;   // lost provinces pay no tax
  const sanc = S.powers.reduce((a, p) => a + (p.st === 'Ally' ? 0.15 : p.st === 'Backer' ? 0.05 : 0), 0);
  const income = R.base * out * (1 - sanc) * (S.strikeT > 0 ? 0.85 : 1);
  const army = sum('army') * ECO.armyPay, police = sum('police') * ECO.policePay + S.P.reduce((a, p) => a + (p.o === 'R' ? p.g : 0), 0) / MEN * ECO.garPay;
  const debt = R.base * ECO.debtShare, want = R.base * ECO.subShare;
  const left = income - army - police - debt, sub = clamp(left, 0, want);
  // war spending crowds out subsidies → prices up → anger in regime provinces
  const cut = 1 - sub / want;
  if (cut > 0.1) { R.infl += cut * ECO.cutInfl; S.P.forEach(p => { if (p.o === 'R') grow(S.P.indexOf(p), Math.round(cut * ECO.anger)); }); rep.eco.push(`Subsidies cut ${Math.round(cut * 100)}% → prices up, support +${Math.round(cut * ECO.anger)}% in regime areas`); }
  R.short = left < 0;
  if (R.short) {
    R.reserves += left;
    if (R.reserves < 0) { R.reserves = 0; R.unpaid++; R.infl += ECO.printInfl; rep.eco.push(`Regime out of reserves → prints money, troops unpaid ${R.unpaid} wk`); }
    else rep.eco.push(`Regime budget short → reserves pay; no new units`);
  } else R.unpaid = 0;
  R.infl = Math.max(0, R.infl - ECO.inflCool);                                                     // inflation slowly cools
  R.lines = { income, army, police, debt, sub, out: Math.round(out * 100), sanc };
  defections(rep);
}
// Defections: unpaid troops (and pay eaten by inflation) may switch sides. Army units roll at defArmy (×0.5).
// The Army HQ (the first army unit at the capital, u.elite) never defects.
function defections(rep) {
  if (!S.R.unpaid) return;
  const ch = BAL.defUnpaid + BAL.defUnpaidWk * (S.R.unpaid - 1) + S.R.infl / 400;
  for (const u of S.U.filter(u => u.side === 'R' && !u.elite)) if (rnd() < ch * (u.type === 'army' ? BAL.defArmy : 1)) defect(u, rep, 'unpaid');
  if (rep.defect) rep.eco.push(`Unpaid ${S.R.unpaid} wk → regime units defected or deserted`);
  syncTotals();
}
// Ordered against their own people: before a fight in a province with ≥ 40% support, each non-elite unit rolls.
function fightDefections(i, rep) {
  if (S.P[i].s < BAL.fightSupp) return;
  const ch = BAL.defFight + (held() >= BAL.splitAt ? BAL.defSplit : 0); if (ch <= 0) return;
  for (const u of unitsAt(i, 'R')) if (!u.elite && rnd() < ch) defect(u, rep, 'crowd');
  syncTotals();
}
// One unit leaves the regime: most join you as militia (half its people), the rest desert.
function defect(u, rep, why) {
  const n = Math.round(u.str / 2), at = S.P.findIndex(p => p.o === 'P'), to = why === 'crowd' ? u.p : at >= 0 ? at : S.home;
  const size = unitName(u.str); (rep.defList = rep.defList || []).push(u.p); u.str = 0; rep.defect++;   // defList: where to show DEFECTED
  if (rnd() < BAL.defJoin) {
    const m = unitsAt(to, 'P').find(v => v.type === 'militia');
    if (m) m.str += n; else S.U.push({ id: S.nextId++, side: 'P', type: 'militia', p: to, str: n, reg: 0, mp: 2, path: [] });
    const gear = rnd() < BAL.defGear ? 2 : 0; S.arms += gear;
    log(`${n.toLocaleString('en')} ${why === 'crowd' ? 'troops refuse to fire on the crowd and' : 'unpaid troops'} join you in ${MAP.p[to].n}` + (gear ? ' with arms (+2)' : ''), 'good');
  } else log(`A regime ${u.type} ${size} ${why === 'crowd' ? 'refuses orders in ' + MAP.p[u.p].n : 'deserts, unpaid'}`, 'good');
  if (why === 'crowd') rep.eco.push(`Support ≥${BAL.fightSupp}% in ${MAP.p[u.p].n}${held() >= BAL.splitAt ? ' + elite split' : ''} → a ${u.type} ${size} defected`);
}

// =================== MAP UNITS (DESIGN CHANGE 11) ===================
// A unit is a token on a province: {id, side:'P'|'R', type, p, str, reg, mp, path}
// Player: 'cell' (lives in S.cells, stealthy) and 'militia' (fights). Regime: 'police', 'army'.
const MOVE_COST = t => ((t === 'hills' || t === 'forest' || t === 'marsh') ? 2 : 1) + (isWinter() ? 1 : 0);   // entering a province (+1 in winter)
const supplyRange = () => isWinter() ? 1 : 2;   // winter: supply lines reach only 1 province
const unitsAt = (i, side) => S.U.filter(u => u.p === i && (!side || u.side === side));
const allPlayerUnits = () => [...S.cells.map(c => Object.assign(c, { side: 'P', type: 'cell' })), ...S.U.filter(u => u.side === 'P')];
function findUnit(id) { return allPlayerUnits().find(u => u.id === id) || S.U.find(u => u.id === id); }

function spawnRegime(r, n, cap, sc) {
  const U = [], k = 1 + Math.floor(sc / 40);
  for (let a = 0; a < k; a++) U.push({ id: 1 + a, side: 'R', type: 'army', elite: a === 0, p: cap, str: Math.round((4 + sc / 20) * MEN * BAL.regime), mp: 2, path: [] });
  for (let a = 0; a < 2 + Math.floor(sc / 30); a++) U.push({ id: 20 + a, side: 'R', type: 'police', p: Math.floor(r() * n), str: Math.round((2 + Math.round(sc / 40)) * MEN * BAL.regime), mp: 2, path: [] });
  return U;
}
// S.militia / S.regulars stay as totals so the top bar and upkeep keep working
function syncTotals() {
  S.U = S.U.filter(u => u.str > 0 || u.reg > 0);
  const mine = S.U.filter(u => u.side === 'P'); S.militia = mine.reduce((a, u) => a + u.str, 0); S.regulars = mine.reduce((a, u) => a + (u.reg || 0), 0);
}
function giveRegulars(n) {
  const at = S.P.findIndex(p => p.o === 'P'), i = at >= 0 ? at : S.home;
  S.U.push({ id: S.nextId++, side: 'P', type: 'militia', p: i, str: 0, reg: n, mp: 2, path: [] }); syncTotals();
}
// Breadth-first search: how many steps from province i to the nearest province that passes test()
function hopsTo(i, test, max) {
  let front = [i], seen = new Set(front);
  for (let d = 0; d <= max; d++) {
    if (front.some(test)) return d;
    const nx = []; front.forEach(f => MAP.p[f].a.forEach(j => { if (!seen.has(j)) { seen.add(j); nx.push(j); } })); front = nx;
  }
  return 99;
}
// Supply: within 2 provinces of a held province, your base, or a safe-house cell
function supplied(i) { const r = supplyRange(); return hopsTo(i, j => S.P[j].o === 'P' || j === S.home || cellsIn(j) > 0, r) <= r; }
// Intel: you see regime units where you hold land or have any token, and next to held land
// Dug in: the regime reinforced it, or has held it with troops for digWeeks+ weeks
function isDug(i) { const p = S.P[i]; return p.o === 'R' && p.g >= BAL.digMin * MEN && !!(p.rf || (p.hw || 0) >= BAL.digWeeks); }
// Scouted: an awake cell in this province or next door watched it this week
function scouted(i) { return S.cells.some(c => !c.dark && (c.p === i || MAP.p[i].a.includes(c.p))); }
function hasIntel(i) {
  if (S.P[i].o === 'P' || S.cells.some(c => c.p === i) || S.U.some(u => u.side === 'P' && u.p === i)) return true;
  return MAP.p[i].a.some(j => S.P[j].o === 'P' || cellsIn(j) > 0);   // cells reveal regime troops next door
}
// Movement points left after the queued path
function mpLeft(u) { return 2 - u.path.reduce((a, j) => a + MOVE_COST(S.P[j].t), 0); }
// Can unit u queue a step into province j? Returns '' if yes, or the reason.
function moveProblem(u, j) {
  const from = u.path.length ? u.path[u.path.length - 1] : u.p;
  if (!MAP.p[from].a.includes(j)) return 'not adjacent';
  if (MOVE_COST(S.P[j].t) > mpLeft(u) && u.path.length) return 'no movement points';   // a fresh unit can always take 1 step
  if (u.type === 'militia' && S.P[j].o === 'R' && !supplied(from)) return 'out of supply: cannot attack';
  const R = supplyRange() + 1; if (!supplied(j) && hopsTo(j, x => S.P[x].o === 'P' || x === S.home || cellsIn(x) > 0, R) > R) return 'outside supply range';
  return '';
}
function queueMove(u, j) { const why = moveProblem(u, j); if (!why) u.path.push(j); return why; }

// Contact battle (the old auto-resolve, now per province). Symbols and numbers only.
function contact(i, rep) {
  if (unitsAt(i, 'P').length) fightDefections(i, rep);                  // some troops won't fight their own people
  const mine = unitsAt(i, 'P'), theirs = unitsAt(i, 'R'), p = S.P[i];
  if (!mine.length || (!theirs.length && p.o === 'P')) return;
  const atk = mine.reduce((a, u) => a + u.str * (S.lead === 'commons' ? 1.15 : 1) + u.reg * 2.2, 0) * (1 + p.s / 200) * (p.o === 'P' ? TDEF[p.t] : 1);
  const dug = isDug(i);                                                 // bonus only if reinforced or dug in
  const def = (p.o === 'R' ? p.g * TDEF[p.t] * (i === MAP.cap.p ? 1.3 : 1) * (dug ? 1 + BAL.digBonus : 1) : 0) + theirs.reduce((a, u) => a + u.str * (u.type === 'army' ? 1.5 : 1), 0);
  if (def <= 0 && p.o === 'R') { p.o = 'P'; log(`${MAP.p[i].n} liberated without a fight`, 'good'); return; }
  const odds = clamp(atk / (atk + def) * 1.1 - 0.05, 0.03, 0.97), win = rnd() < odds;
  const blind = dug && !scouted(i);                                     // no recon on a dug-in province: pay extra
  const loss = Math.max(BAL.minLoss * MEN, Math.round(   // a battle always costs at least minLoss companies
   (win ? 0.15 : 0.45) * mine.reduce((a, u) => a + u.str, 0) * (blind ? 1 + BAL.unscoutedLoss : 1)
   * (p.atk != null && S.week - p.atk <= BAL.refrontWeeks ? 1 + BAL.refrontLoss : 1)));   // charging the same front again: tired, expected
  if (blind) (rep.blind = rep.blind || []).push(i);
  if (p.atk != null && S.week - p.atk <= BAL.refrontWeeks) (rep.refront = rep.refront || []).push(i);
  p.atk = S.week;                                                        // remember this front for the re-attack penalty
  let left = loss; for (const u of mine) { const t = Math.min(u.str, left); u.str -= t; left -= t; if (!win && u.reg) { u.reg = Math.max(0, u.reg - MEN); } }
  let enemyLoss = 0;
  if (win) {
    enemyLoss = theirs.reduce((a, u) => a + u.str, 0) + p.g; S.U = S.U.filter(u => !(u.side === 'R' && u.p === i));
    if (p.o === 'R') { p.o = 'P'; p.g = 0; p.s = Math.min(100, p.s + 10); S.esc = Math.min(6, Math.max(S.esc, 1 + Math.floor(held() / 3))); }
    log(`Battle for ${MAP.p[i].n}: won (−${loss.toLocaleString('en')} fighters)`, 'good');
  } else {
    enemyLoss = Math.round(def * 0.25); theirs.forEach(u => u.str = Math.max(MEN, u.str - MEN));
    if (p.o === 'R') {                                                  // a failed attack: extra losses, heat, blame
      let extra = loss * (BAL.lossMul - 1); for (const u of mine) { const t = Math.min(u.str, extra); u.str -= t; extra -= t; }
      S.heat = clamp(S.heat + BAL.lossHeat, 0, 100); p.s = Math.max(0, p.s - BAL.lossSupp);
      const back = mine[0].from; mine.forEach(u => { if (back != null) u.p = back; });   // retreat
    }
    else { p.o = 'R'; p.g = MEN; mine.forEach(u => { const j = MAP.p[i].a.find(j => S.P[j].o === 'P'); u.p = j != null ? j : S.home; }); }
    log(`Battle for ${MAP.p[i].n}: lost (−${loss.toLocaleString('en')} fighters)`, 'bad');
  }
  syncTotals();
  rep.fights.push({ p: i, win, loss, enemyLoss, odds: Math.round(odds * 100) });
}

// Regime unit AI: score every option (stay or a neighbour) and take the best (utility AI)
function regimeMove(u) {
  if (S.cease > 0) return;
  const known = S.cells.filter(c => c.known).map(c => c.p);
  const threatCap = hopsTo(MAP.cap.p, j => S.U.some(v => v.side === 'P' && v.p === j), 2) <= 2;
  let best = u.p, bestV = -1e9;
  for (const j of [u.p, ...MAP.p[u.p].a]) {
    if (j !== u.p && u.type === 'army' && isMud() && !isRoad(j)) continue;          // mud: armour stays on roads
    let v = rnd() * 4 - (j === u.p ? 0 : MOVE_COST(S.P[j].t));
    if (u.type === 'army') {
      if (threatCap) v -= hopsTo(j, x => x === MAP.cap.p, 6) * 8;                      // protect the capital
      if (S.phase >= 4 && S.P[j].o === 'P') v += 30 - unitsAt(j, 'P').reduce((a, w) => a + w.str + w.reg * 2, 0) / MEN * 3 + u.str / MEN * 2;   // retake
    } else {
      if (S.P[j].o === 'P') v -= 50;                                                    // police avoid liberated land
      if (known.length) v -= hopsTo(j, x => known.includes(x), 6) * 10;                 // chase flagged cells
      v += S.P[j].s / 4;                                                                // patrol restless areas
    }
    if (v > bestV) { bestV = v; best = j; }
  }
  return best;
}

// Weekly unit tick: player moves, contact, regime moves, contact, supply attrition
function unitPhase(rep) {
  const moves = rep.moves;
  for (const u of allPlayerUnits()) {
    if (u.path.length) {
      u.from = u.p; u.p = u.path[u.path.length - 1]; moves.push({ id: u.id, path: [u.from, ...u.path] });
      if (u.type === 'cell') S.moveExp = (S.moveExp || 0) + 0.04 * (1 + S.P[u.p].urb) * (S.sc / 50);   // cells moving near sensors
    }
    u.path = [];
  }
  S.U.filter(u => u.side === 'P').forEach(u => { if (S.P[u.p].o === 'R' || unitsAt(u.p, 'R').length) contact(u.p, rep); });
  const seenBefore = new Set(S.U.filter(u => u.side === 'R' && hasIntel(u.p)).map(u => u.id));
  for (const u of S.U.filter(u => u.side === 'R')) {
    if (u.type === 'police' && S.phase < 2) continue;
    if (u.type === 'army' && S.phase < 3) continue;
    const to = regimeMove(u); if (to == null || to === u.p) continue;
    moves.push({ id: u.id, path: [u.p, to] }); u.from = u.p; u.p = to;
    // police near a cell can flag it, and roll up a flagged one
    S.cells.filter(c => c.p === to && u.type === 'police').forEach(c => { c.known = true; c.heat = clamp((c.heat || 0) + BAL.flagHeat, 0, 100); log(`Police patrol in ${MAP.p[to].n}: your cell's heat +${BAL.flagHeat}`, 'bad'); });
    if (unitsAt(to, 'P').length) contact(to, rep);
    else if (u.type === 'army' && S.P[to].o === 'P') { S.P[to].o = 'R'; S.P[to].g = MEN; log(`Regime army retook ${MAP.p[to].n}`, 'bad'); rep.fights.push({ p: to, win: false, loss: 0, enemyLoss: 0, odds: 0 }); }
  }
  rep.newSeen = S.U.filter(u => u.side === 'R' && hasIntel(u.p) && !seenBefore.has(u.id)).length;
  // unsupplied militia lose 10% strength
  S.U.filter(u => u.side === 'P' && !supplied(u.p)).forEach(u => { u.str = Math.max(0, u.str - Math.max(MEN / 2, Math.round(u.str * 0.1))); });   // at least half a company drifts away
  // reinforcements: a new police unit every 4 weeks at the capital while the regime still holds it
  if (S.week % 4 === 0 && S.P[MAP.cap.p].o === 'R' && reinforce()) S.U.push({ id: S.nextId++, side: 'R', type: S.phase >= 4 ? 'army' : 'police', p: MAP.cap.p, str: Math.round(3 * MEN * BAL.regime), mp: 2, path: [] });
  syncTotals();
}

// ================= 0.4.0 REGIME RESPONSE =================
// Threat (0-100) is how scared the regime is of you. Four factions inside the regime
// argue about it: hawks (hardliners, security chiefs) push the escalation rung up,
// moderates and oligarchs pull it down. The rung (0-5) decides what the regime does each week.
const FACS = ['hardliners', 'moderates', 'security', 'oligarchs'];
const RUNG_NAME = ['none', 'Police surge', 'Riot units + curfew', 'Army recalled', 'Reserves + emergency budget', 'Conscription + allies'];
function regimeInit(S) {
  S.rung = S.rung || 0; S.rungDown = 0; S.threat = S.threat || 0; S.heldWas = 0;
  S.fac = S.fac || { hardliners: 20, moderates: 10, security: 30, oligarchs: 25 };   // loyalty to the leader, -100..100
}
function threatScore() {
  return Math.round(clamp(held() * BAL.thHeld + avgSupport() * BAL.thSupp + S.fightsWk * BAL.thFight + S.heat * BAL.thHeat, 0, 100));
}
const facAdd = (k, d) => S.fac[k] = clamp(S.fac[k] + d, -100, 100);
// The front province the regime fears most: a regime province next to yours with the most support
function hottest() {
  let best = -1; S.P.forEach((p, i) => { if (p.o === 'R' && adjHeld(i) && (best < 0 || p.s > S.P[best].s)) best = i; });
  return best >= 0 ? best : MAP.cap.p;
}
function regimeResponse(rep) {
  if (!S.fac) regimeInit(S);
  S.fightsWk = rep.fights.length;
  const lost = Math.max(0, held() - S.heldWas); S.heldWas = held();   // provinces the regime lost this week
  S.threat = threatScore();
  // 1) your actions move the factions
  facAdd('hardliners', S.fightsWk * 2 + lost * 3);                     // fighting makes the hawks louder
  facAdd('security', (S.arrests || []).length * 3 + (S.heat > 70 ? 1 : 0));   // arrests prove the police are working
  facAdd('moderates', S.threat < 30 ? 1 : -1 - (S.rung >= 4 ? 2 : 0));   // calm years please moderates; conscription doesn't
  facAdd('oligarchs', -lost * 3 - (S.R.infl > 8 ? 1 : 0) - (S.rung >= 4 ? 2 : 0));   // lost taxes and inflation hurt business
  FACS.forEach(k => S.fac[k] -= S.fac[k] * BAL.facDrift);              // everyone slowly calms down
  // 2) the factions pick the rung they want
  const push = (S.fac.hardliners + S.fac.security - S.fac.moderates - S.fac.oligarchs) / BAL.facPush;
  let want = clamp(Math.round(S.threat / BAL.rungPer + push), 0, 5);
  if (held() >= 3) want = Math.max(want, 1);                           // never ignores a strong revolt
  const loud = FACS.slice().sort((a, b) => Math.abs(S.fac[b]) - Math.abs(S.fac[a]))[0];
  S.why.rung = `Threat ${S.threat} · ${push >= 0.25 ? 'hawks push up' : push <= -0.25 ? 'moderates hold back' : 'factions split'} (${loud} loudest)`;
  // 3) step up at once, step down only after downWeeks calm weeks in a row (it can't de-escalate fast)
  if (want > S.rung) { S.rung++; S.rungDown = 0; rep.rungUp = S.rung; rungEnter(S.rung); log(`ESCALATION · rung ${S.rung}: ${RUNG_NAME[S.rung]}`, 'bad'); }
  else if (want < S.rung) { if (++S.rungDown >= BAL.downWeeks) { S.rung--; S.rungDown = 0; rep.rungDown = S.rung; log(`De-escalation · rung ${S.rung}`, 'good'); } }
  else S.rungDown = 0;
  // a faction report when one turns sharply (for the stinger and the log)
  const hot = FACS.find(k => Math.abs(S.fac[k]) >= 50 && !(S.facSaid || {})[k]);
  if (hot) { (S.facSaid = S.facSaid || {})[hot] = 1; rep.faction = hot; log(`Regime faction: ${hot} ${S.fac[hot] > 0 ? 'rally behind' : 'turn against'} the leader`, 'reg'); }
  rungWeek(rep);
  persTick(rep);                                                       // 0.5.6 persecution policies
}
// One-off effects when a rung is first reached
function rungEnter(r) {
  const h = hottest();
  if (r === 3) { S.U.push({ id: S.nextId++, side: 'R', type: 'army', p: h, str: Math.round(BAL.r3Army * MEN * BAL.regime), mp: 2, path: [] });
    S.powers.forEach(p => p.rel = clamp(p.rel + BAL.r3Meddle, -100, 100)); }   // borders thin out: neighbours meddle more
  if (r === 5) S.P.forEach(p => { if (p.o === 'R') p.g += Math.round(BAL.r5Garrison * MEN); });   // conscripts fill every garrison
}
// Every-week effects of the current rung (each one costs the regime something)
function rungWeek(rep) {
  const r = S.rung; if (!r) return;
  S.R.reserves = Math.max(0, S.R.reserves - r * BAL.rungCost);         // escalation burns the reserve fund
  if (r >= 1) S.cells.forEach(c => { if (!c.dark) c.heat = (c.heat || 0) + BAL.r1Heat; });   // more police on the streets
  if (r >= 2) { const h = hottest(); if (S.P[h].cur === 0) { S.P[h].cur = BAL.r2Curfew + 1; S.P[h].s = Math.min(100, S.P[h].s + 1); } }   // curfew angers locals a little
  if (r >= 4) { S.R.infl += BAL.r4Infl; if (S.week % BAL.r4Every === 0) { const h = hottest(); if (S.P[h].o === 'R') { S.P[h].g += Math.round(MEN * BAL.regime); S.P[h].rf = 1; } } }
  if (r >= 5) S.P.forEach(p => { if (p.o === 'R') p.s = Math.min(100, p.s + BAL.r5Anger); });   // conscription makes people angry
}

// ================= 0.5.0a GRIEVANCE CARDS =================
// Each province carries 1-3 story cards. A card has a severity (1-3 heat pips) and fades over time.
// Every week a card adds a little support; "Organize grievance" spends it for a big boost.
// The stories are invented but drawn from common historical causes. 25 words max each.
const GRIEV = {
  closure: { t: 'Plant closure', x: 'The tractor plant shut overnight. Eight hundred families lost their only wage.' },
  vote: { t: 'Rigged vote', x: 'Ballot boxes left the school sealed and came back full. Everyone saw it.' },
  killing: { t: 'Police killing', x: 'A student died in custody. The report says he fell down the stairs.' },
  bread: { t: 'Bread price spike', x: 'Bread doubled in a month. Queues start before dawn and end in shouting.' },
  land: { t: 'Land seizure', x: 'Farms along the river were taken for a minister\'s resort. No payment came.' },
  minority: { t: 'Group singled out', x: 'Families from one district are refused jobs and housing. The papers call them a threat.' },
  wages: { t: 'Unpaid wages', x: 'Miners have not been paid for three months. The company says the state owes it.' },
  drought: { t: 'Drought ignored', x: 'Wells are dry, and the water aid went to the capital instead.' },
  pension: { t: 'Pensions cut', x: 'Pensions were cut by a third. Old people now sell their furniture at the market.' },
  hospital: { t: 'Hospital collapse', x: 'The hospital has no medicine. Doctors ask families to bring their own.' },
  press: { t: 'Paper shut down', x: 'The only independent paper was closed. Its editor has not been seen since.' },
  fuel: { t: 'Fuel shortage', x: 'Fuel is rationed. Buses stopped, and workers walk two hours to the factory.' },
  conscripts: { t: 'Sons taken', x: 'Army trucks took young men from the market. Parents were told nothing.' },
  corruption: { t: 'Governor\'s palace', x: 'The governor built a palace while the school roof fell in.' },
  evictions: { t: 'Evictions', x: 'Whole streets were cleared for a new ministry. Families sleep in the station.' },
  students: { t: 'University purge', x: 'Professors who signed a letter were fired. Students lost their exams.' },
  church: { t: 'Faith restricted', x: 'Prayer houses need a permit now. Most requests are refused.' },
  flood: { t: 'Flood cover-up', x: 'The dam failed and the state blamed the rain. Villages are still underwater.' },
  taxes: { t: 'New market tax', x: 'Stall owners pay a new tax to the police every morning.' },
  power: { t: 'Blackouts', x: 'Power is off twelve hours a day here, but never in the capital.' },
  language: { t: 'Language banned', x: 'Schools may no longer teach in the local language. Teachers who refuse are fined.' },
  pollution: { t: 'Poisoned river', x: 'The chemical works dumps into the river. Children are getting sick.' },
  border: { t: 'Border closed', x: 'The border crossing closed. Traders lost their trade and their savings.' },
  martial: { t: 'Martial law', x: 'Soldiers on every corner. A curfew at six, and arrests for being late.' },
};
const GKEYS = Object.keys(GRIEV);
// Deal from a hash of the game seed (its own number, NOT rnd()), so every game differs but the dice don't change
function gvEnsure() {
  if (S.gvOn) return; S.gvOn = 1;
  const seed = S.gvSeed = S.gvSeed || S.seed;                          // remembered, so a reload deals the same
  S.P.forEach((p, i) => { const h = hashStr(seed + ':' + i), n = 1 + h % 3; p.gv = [];
    for (let k = 0; k < n; k++) p.gv.push({ k: GKEYS[((h >>> 4) + k * 7) % GKEYS.length], sev: 1 + ((h >>> 12) + k) % 3, wk: S.week }); });
}
function gvAdd(i, k) {
  const L = S.P[i].gv = S.P[i].gv || [];
  const old = L.find(g => g.k === k); if (old) { old.sev = Math.min(3, old.sev + 1); return; }   // same story again: it gets worse
  if (L.length >= 3) L.shift();                                        // at most 3 cards: the oldest fades out
  L.push({ k, sev: 2, wk: S.week }); (S.gvNew = S.gvNew || []).push({ p: i, k });
}
function gvTick(rep) {
  gvEnsure(); rep.gvNew = S.gvNew || []; S.gvNew = [];
  S.P.forEach((p, i) => { p.gv.forEach(g => grow(i, BAL.gvSupp * g.sev));   // grievances drive support growth
    p.gv.forEach(g => { if (S.week - g.wk >= 8) { g.sev--; g.wk = S.week; } }); p.gv = p.gv.filter(g => g.sev > 0); });   // fade 1 pip per 8 weeks
}

// ================= 0.5.2 RALLY MESSAGING =================
// A Rally offers 3 speech lines. Each has hidden tags and a tone. The score compares the tags with
// this province's grievance cards and the tone with what the locals like. One line is a decoy:
// it sounds strong but fits nothing here. Repeating a line wears it out.
const GTAG = { closure: 'wages', wages: 'wages', pension: 'wages', vote: 'vote', press: 'vote', students: 'vote', land: 'land', evictions: 'land', flood: 'land', drought: 'land',
  killing: 'police', martial: 'police', conscripts: 'police', taxes: 'police', bread: 'prices', fuel: 'prices', power: 'prices', hospital: 'prices', corruption: 'prices', border: 'prices',
  minority: 'identity', church: 'identity', language: 'identity', pollution: 'land' };
const LINES = [
  { t: 'They took your wages and gave them to their friends.', tags: ['wages'], tone: 'angry' },
  { t: 'Every family here deserves a fair day\'s pay.', tags: ['wages'], tone: 'hopeful' },
  { t: 'Your vote was stolen. Next time we count it together.', tags: ['vote'], tone: 'hopeful' },
  { t: 'They fear the ballot box more than any army.', tags: ['vote'], tone: 'calm' },
  { t: 'This land fed your grandparents. It is still yours.', tags: ['land'], tone: 'calm' },
  { t: 'Nobody in uniform is above the law.', tags: ['police'], tone: 'angry' },
  { t: 'Bread, fuel, light: they priced you out of your own life.', tags: ['prices'], tone: 'angry' },
  { t: 'We can bring prices down when we stand together.', tags: ['prices'], tone: 'hopeful' },
  { t: 'Your faith, your language and your name belong here.', tags: ['identity'], tone: 'calm' },
  { t: 'The whole world is watching us tonight!', tags: [], tone: 'angry' },          // decoys: sound big, fit nothing
  { t: 'History will remember who stood up first!', tags: [], tone: 'hopeful' },
];
const TONES = ['angry', 'hopeful', 'calm'];
const toneOf = i => TONES[hashStr((S.gvSeed || 1) + 't' + i) % 3];   // what the locals respond to (hidden)
// The 3 lines on offer: the best fit, another line, and a decoy, in a shuffled order
function rallyOffer(i) {
  const tags = new Set((S.P[i].gv || []).map(g => GTAG[g.k])), h = hashStr(S.week + ':' + i);
  const real = LINES.map((L, k) => k).filter(k => LINES[k].tags.length);
  const fit = real.filter(k => LINES[k].tags.some(t => tags.has(t)));
  const a = fit.length ? fit[h % fit.length] : real[h % real.length];
  const b = real.filter(k => k !== a)[(h >>> 3) % (real.length - 1)], dec = h % 2 ? 9 : 10;
  return [a, b, dec].sort((x, y) => hashStr(h + ':' + x) - hashStr(h + ':' + y));
}
// Score a line: tag match counts most, tone helps, repeats wear off. Returns {mul, ok, why}
function rallyScore(i, k) {
  const L = LINES[k], cards = S.P[i].gv || [], hit = cards.find(g => L.tags.includes(GTAG[g.k]));
  const tone = L.tone === toneOf(i), used = (S.said && S.said[k]) || 0;
  let mul = (hit ? 1 + 0.25 * hit.sev : 0) + (tone ? 0.5 : 0);
  mul /= 1 + used;                                                     // the same line again: weaker every time
  if (mul < 0.4) return { mul: -1, ok: false, why: hit ? 'Heard it too often: people tuned out.' : `Fit no grievance here${tone ? '' : ', and the tone was wrong'}.` };
  return { mul, ok: true, why: hit ? `${GRIEV[hit.k].t} is a grievance here${tone ? ', and the tone was right' : ''}.` : 'The tone was right, but it fit no grievance.' };
}
// Play a chosen line through the normal Rally action (same costs and checks)
function rallyWith(i, k) {
  const r = rallyScore(i, k), a = ACTIONS.find(a => a.id === 'rally'); if (!canDo(a, i)) return null;
  S.rallyMul = r.mul; const msg = doAction(a, i); S.rallyMul = null; if (!msg) return null;
  (S.said = S.said || {})[k] = ((S.said[k]) || 0) + 1; oppSpeech(LINES[k].tags, r.ok); return Object.assign(r, { msg });
}

// ================= 0.5.4 OPPOSITION FACTIONS + LEADERS =================
// 12 groups who might join you. Each wants 2 grievance tags fixed, has a red line (one of your
// actions it hates) and brings something once it joins at loyalty 40+. All names are invented.
const OPP = [
  { t: 'students', n: 'Lantern Square Students', tags: ['vote', 'police'], red: 'militia', b: 'people' },
  { t: 'unions', n: 'Red Loom Workers\' Union', tags: ['wages', 'prices'], red: 'fund', b: 'people' },
  { t: 'farmers', n: 'Green Furrow League', tags: ['land', 'prices'], red: 'strike', b: 'people' },
  { t: 'faith', n: 'Brotherhood of the Quiet Bell', tags: ['identity', 'police'], red: 'sab', b: 'legit' },
  { t: 'minority', get n() { return minorName() + ' Families Council'; }, tags: ['identity', 'land'], red: 'smug', b: 'people' },
  { t: 'nationalists', n: 'Banner of the Old Crown', tags: ['vote', 'land'], red: 'smug', b: 'people' },
  { t: 'moderates', n: 'Civic Charter Circle', tags: ['vote', 'prices'], red: 'militia', b: 'legit' },
  { t: 'veterans', n: 'Grey Coat Officers\' Club', tags: ['police', 'wages'], red: 'sab', b: 'info' },
  { t: 'business', n: 'Harbor Merchants\' Guild', tags: ['prices', 'wages'], red: 'strike', b: 'cash' },
  { t: 'hardliners', n: 'Iron Hand Brotherhood', tags: ['police', 'identity'], red: 'pamph', b: 'info' },
  { t: 'separatists', n: 'Free Highlands Front', tags: ['land', 'identity'], red: 'drill', b: 'people' },
  { t: 'exiles', n: 'Voices Abroad Network', tags: ['vote', 'wages'], red: 'fund', b: 'legit' },
];
const RIVAL = { nationalists: 'minority', minority: 'nationalists', business: 'unions', unions: 'business', hardliners: 'moderates', moderates: 'hardliners' };
const TRAITS = ['corrupt', 'paranoid', 'cruel', 'cult', 'family'];
const FIRST = ['Anika', 'Teodor', 'Mira', 'Lukan', 'Sefa', 'Orel', 'Ilsa', 'Davor', 'Zora', 'Bren', 'Kasia', 'Emrik'];
const LAST = ['Vales', 'Dornik', 'Halloran', 'Petrash', 'Quill', 'Marov', 'Sendrin', 'Ostrova', 'Kell', 'Varga', 'Lindqvist', 'Rusca'];
const TITLE = ['Chair', 'Speaker', 'Elder', 'Secretary', 'Captain', 'Voice'];
// Factions start lukewarm, with an invented leader and 2 traits picked from the seed hash (not the dice)
function oppEnsure() {
  if (S.opp) return;
  const seed = S.gvSeed || S.seed;
  S.opp = OPP.map((f, k) => { const h = hashStr(seed + 'f' + k), t1 = h % 5, t2 = (t1 + 1 + (h >>> 3) % 4) % 5;
    return { t: f.t, loy: (h >>> 6) % 31 - 10, joined: false, known: false,
      lead: { name: FIRST[(h >>> 9) % 12] + ' ' + LAST[(h >>> 13) % 12], title: TITLE[(h >>> 17) % 6], traits: [TRAITS[t1], TRAITS[t2]], cap: 0, lost: false } }; });
}
const oppEvent = (k, msg, sfx) => { log(msg, k); (S.oppFx = S.oppFx || []).push(sfx); };   // sfx is played by the UI (at most one per week)
function oppAdd(f, d) {
  const F = OPP.find(o => o.t === f.t), was = f.joined;
  f.loy = clamp(f.loy + d, -100, 100);
  if (!f.joined && f.loy >= BAL.oppJoin - (f.lead.traits.includes('cult') ? 10 : 0)) {   // a cult leader brings the group faster
    f.joined = true; oppEvent('good', `${F.n} joined the movement`, 'factionJoin');
    const r = S.opp.find(o => o.t === RIVAL[f.t]); if (r) r.loy = clamp(r.loy - 10, -100, 100);   // old rivals don't like it
  } else if (was && f.loy <= BAL.oppSplit && !f.lead.traits.includes('paranoid')) {    // a paranoid leader keeps the group together
    f.joined = false; f.loy = -10; oppEvent('bad', `${F.n} split: one wing walked out`, 'factionSplit');
  }
}
// Your actions: crossing a faction's red line costs 30 loyalty, reveals it, and a joined faction betrays you
function oppAct(id) {
  if (!S.opp) return;
  S.opp.forEach(f => { const F = OPP.find(o => o.t === f.t); if (F.red !== id) return; f.known = true;
    if (f.joined) { f.joined = false; f.loy = -20; S.heat += 5; oppEvent('bad', `${F.n} betrayed you (red line: ${(ACTIONS.find(a => a.id === id) || { n: id }).n})`, 'factionBetray'); }
    else oppAdd(f, -BAL.oppRed); });
}
// Rally lines please the factions whose tags they hit (a backfire annoys them)
function oppSpeech(tags, ok) { if (S.opp) S.opp.forEach(f => { if (OPP.find(o => o.t === f.t).tags.some(t => tags.includes(t))) oppAdd(f, ok ? BAL.oppSpeech : -BAL.oppSpeech / 2); }); }
function oppTick(rep) {
  oppEnsure();
  const live = new Set(); S.P.forEach(p => { if (p.s > 20) (p.gv || []).forEach(g => live.add(GTAG[g.k])); });   // grievances that people feel
  S.opp.forEach(f => {
    const F = OPP.find(o => o.t === f.t);
    oppAdd(f, F.tags.some(t => live.has(t)) ? BAL.oppGv : -0.25);
    if (!f.joined) return;
    const m = f.lead.cap ? 0.5 : 1;                                     // a jailed leader halves what the group brings
    if (F.b === 'people') S.supp += Math.round(BAL.oppPeople * m);
    if (F.b === 'cash') S.wealth += BAL.oppCash * m;
    if (F.b === 'info') S.heat = Math.max(0, S.heat - BAL.oppInfo * m);   // keep the fraction (rounding ate 0.3 drops); the UI rounds
    if (F.b === 'legit') S.powers.forEach(p => p.rel = clamp(p.rel + BAL.oppLegit * m, -100, 100));
  });
  // arrests can catch a joined faction's leader; after 4 weeks they escape (50%) or are lost for good
  (S.arrests || []).forEach(() => { const L = S.opp.filter(f => f.joined && !f.lead.cap && !f.lead.lost); if (L.length && rnd() < BAL.oppCatch) {
    const f = L[Math.floor(rnd() * L.length)]; f.lead.cap = S.week; oppAdd(f, -10); oppEvent('bad', `${f.lead.title} ${f.lead.name} (${OPP.find(o => o.t === f.t).n}) captured`, 'leaderCaptured'); } });
  S.opp.forEach(f => { if (f.lead.cap && S.week - f.lead.cap >= 4) { const ok = rnd() < 0.5; f.lead.cap = 0;
    if (ok) log(`${f.lead.name} escaped and is back`, 'good'); else { f.lead.lost = true; oppAdd(f, -15); oppEvent('bad', `${f.lead.name} was lost in prison`, 'leaderLost'); } } });
  rep.oppFx = S.oppFx || []; S.oppFx = [];
}

// ================= 0.5.6 PERSECUTION =================
// Each country gets one invented minority (never a real group): a name, a culture word and a home
// province. When the regime escalates it passes policies against them. Each policy is a grievance card:
// it pushes the minority faction toward you and raises support for the revolt. Serious tone, no slurs.
const MINOR = [['Vellish', 'the Vell songs'], ['Oskari', 'the river feasts'], ['Tamren', 'the old script'], ['Halvic', 'the mountain rites'], ['Sorune', 'the weaving guilds'], ['Kerai', 'the winter fair']];
function minorEnsure() {
  if (S.minor) return; const h = hashStr((S.gvSeed || S.seed) + 'm'), M = MINOR[h % MINOR.length];
  S.minor = { n: M[0], word: M[1], home: (h >>> 5) % S.P.length };
}
const minorName = () => (typeof S !== 'undefined' && S && S.minor ? S.minor.n : 'Vellish');
// Policy cards. Getters put this country's minority into the text when it's shown.
const POLICY = {
  jobban: { t: 'Job ban', get x() { return `${minorName()} workers are barred from state jobs. Many were fired the same week.`; } },
  langban: { t: 'Schools closed', get x() { return `${minorName()} schools were shut, and ${S.minor ? S.minor.word : 'their customs'} may no longer be taught.`; } },
  segregate: { t: 'Separate districts', get x() { return `${minorName()} families must live in marked districts and carry special papers.`; } },
  relocate: { t: 'Forced relocation', get x() { return `Whole ${minorName()} villages were moved by bus to camps in the north.`; } },
  policing: { t: 'Unequal policing', get x() { return `${minorName()} men are stopped and searched daily. Complaints are never answered.`; } },
};
Object.assign(GRIEV, POLICY); Object.keys(POLICY).forEach(k => { GTAG[k] = 'identity'; });   // policies are identity grievances
const isPolicy = k => k in POLICY;
function persTick(rep) {
  minorEnsure();
  if (S.rung < BAL.persRung || rnd() >= BAL.persChance) return;        // only an escalating regime does this
  const ks = Object.keys(POLICY), k = ks[Math.floor(rnd() * ks.length)];
  const i = rnd() < 0.6 ? S.minor.home : Math.floor(rnd() * S.P.length);   // usually where the minority lives
  gvAdd(i, k); grow(i, BAL.persSupp);
  const f = (S.opp || []).find(o => o.t === 'minority'); if (f) oppAdd(f, BAL.persLoy);
  rep.persec = { p: i, k }; log(`Regime policy in ${MAP.p[i].n}: ${POLICY[k].t} against the ${minorName()}`, 'bad');
}
// A crackdown scares the joined factions whose grievances live in that province
function persHitBacked(i) {
  const tags = new Set((S.P[i].gv || []).map(g => GTAG[g.k]));
  (S.opp || []).forEach(f => { if (f.joined && OPP.find(o => o.t === f.t).tags.some(t => tags.has(t))) oppAdd(f, -BAL.persHit); });
}
