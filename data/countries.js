// data/countries.js: approximate public figures, rounded (USD). Used for display and to scale the sim.
// Sources (approx., 2023-24): World Bank (pop, GDP), national budget laws / IMF (state budget, reserves),
// IISS Military Balance (active troops), national police reports (police). Treat every number as "approx."
// pop = people, gdp/budget/reserves = USD, troops/police = people.
const COUNTRY_DATA = {
  POL: { pop: 37.6e6, gdp: 845e9, budget: 215e9, reserves: 205e9, troops: 164000, police: 100000 },
  ESP: { pop: 48.3e6, gdp: 1.58e12, budget: 640e9, reserves: 95e9, troops: 122000, police: 150000 },
  MEX: { pop: 129e6, gdp: 1.79e12, budget: 480e9, reserves: 215e9, troops: 277000, police: 380000 },
  ARG: { pop: 46.0e6, gdp: 640e9, budget: 110e9, reserves: 25e9, troops: 72000, police: 230000 },
};
// Countries without a row get a regional-style estimate from GDP and population (flagged "est.").
function countryData(iso, info) {
  const d = COUNTRY_DATA[iso]; if (d) return Object.assign({ est: false }, d);
  const pop = info.pop || 1e6, gdp = (info.gdp || 1e4) * 1e6;   // world.json gdp is in million USD
  return { pop, gdp, budget: gdp * 0.3, reserves: gdp * 0.12, troops: Math.round(pop * 0.0035), police: Math.round(pop * 0.003), est: true };
}
if (typeof module !== 'undefined') module.exports = { COUNTRY_DATA, countryData };
