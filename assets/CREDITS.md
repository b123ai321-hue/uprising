# Emberline art credits
All visuals (emberline-art.js: map regions, roads, unit tokens, faction emblems, title card) are original, code-drawn by Game Artist for the Emberline team, 2026-10-19. No third-party assets.

## Map data (mockups F1–F4, 2026-10-19)
- Natural Earth (naturalearthdata.com), public domain: 10m admin-1 states/provinces (Türkiye, Poland/Lesser Poland area, Kazakhstan), 10m populated places, 10m rivers, 10m roads, 10m railroads, 110m admin-0 countries. Extracted to small JSON files (tr.json, pl.json, kz.json, world.json). All other art is original code-drawn; all factions and names invented.
- Audio (assets/sfx.js, assets/music.js): original, synthesized in code with Web Audio; no samples or recordings.

## Map data (mockups G1–G4, G-pc, 2026-10-19)
- Natural Earth (public domain): 10m admin-1 for United States (lower 48), Germany, Mongolia; 10m populated places; reused Kazakhstan from F-series. Extracted to us.json, de.json, mn.json. All factions, contractors (Corvid Lattice) and leader names invented; no real companies or persons.

## Game map + economy data (v1 first playable, 2026-10-19)
- Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com (public domain): 110m admin-0 countries (world.json), 50m admin-0 countries (outlines for small states, plus POP_EST/GDP_MD/ECONOMY/INCOME_GRP fields), 10m admin-1 states/provinces and 10m populated places (data/<ISO3>.json). Built by tools/build_maps.py.
- Natural Earth's population and GDP fields come from World Bank/IMF snapshots (CC BY 4.0), labeled approximate in game. Debt, reserves, industry and import figures are game estimates.
- All factions, regimes, leaders, governments and the contractor "Corvid Lattice" are invented.
- Unit tokens (assets/tokens.js, tokens-preview.html, 2026-10-19): original, code-drawn on canvas. Invented insignia (linked nodes, ember, watch lens, stacked blocks); no real police, military, NATO or other emblems, flags or logos.
- Season/weather art (assets/season.js, season-preview.html, 2026-10-19): original, code-drawn on canvas. Invented glyphs (sprout, sun, leaf, crystal; rain/snow/storm marks) and winter tint; no third-party assets.
- Live site icons and state badges (sites.js): original code-drawn by the studio team
- Escalation ladder + regime faction icons (regime.js): original code-drawn by the studio team
- Grievance card + Rally panel (assets/rally.js): original, code-drawn by the studio team.
- Faction emblems, faction rows, leader card, trait badges, persecution marker (assets/factions.js): original, code-drawn by the studio team.
- Security screen kit: gauges, capability score, countermeasure toggles, detection dice, cell link graph (assets/security.js): original, code-drawn by the studio team.
- regimes.js: regime-type picker art, original, by the studio team.
- foreign.js: foreign powers art (invented emblems, stance meter, deal card), by the studio team.
- after.js: post-revolt art (sanctions rows, invasion arrows, threat banner), by the studio team.
