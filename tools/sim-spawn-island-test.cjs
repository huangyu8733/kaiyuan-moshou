// Regression for the "hero cannot leave the DotA base" bug (specs/dota-683d-ai).
//
// DotA v6.83d's war3map.w3b overrides the decorative tree wall `YTlb` with `bptx` = "" —
// "no pathing". The stamp pass used to read only Units\DestructableData.slk, whose `YTlb`
// is PathTextures\2x2Default.tga, so all 193 hedges around each fountain were stamped 2×2
// and the plaza became an island (the ring closed at one corner tree). MapDestructablePathing
// folds the .w3b overrides in; this test reproduces the ring on a synthetic grid.
//
// Run: pnpm sim:test  (compiles src/data/objectData.ts + src/sim/* → .sim-build)
const { join } = require("node:path");
const REPO = join(__dirname, "..");
require("node:fs").writeFileSync(join(REPO, ".sim-build", "package.json"), '{"type":"commonjs"}');
const { PathingGrid, PATHING_CELL } = require(join(REPO, ".sim-build", "src", "sim", "pathing.js"));
const { stampFootprints } = require(join(REPO, ".sim-build", "src", "sim", "destructibles.js"));
const { mapDestructablePathing } = require(join(REPO, ".sim-build", "src", "data", "objectData.js"));

let failures = 0;
function check(name, cond, detail) {
  if (cond) return;
  failures++;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

/** A 2×2 all-blocked pathing texture, as PathTextures\2x2Default.tga decodes to. */
function tga2x2() {
  const b = new Uint8Array(18 + 2 * 2 * 3);
  b[2] = 2; b[12] = 2; b[14] = 2; b[16] = 24;
  b.fill(255, 18);
  return b;
}
const HEDGE = tga2x2();

/** war3map.w3b, version 2: one ORIGINAL object (`YTlb`) with `bptx` = "", one CUSTOM (`B000`). */
function w3b(originalPathTex, customPathTex, customPathTexDeath) {
  const out = [];
  const i32 = (v) => out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  const s4 = (s) => { for (let i = 0; i < 4; i++) out.push(s.charCodeAt(i)); };
  const str = (s) => { for (const ch of s) out.push(ch.charCodeAt(0)); out.push(0); };
  i32(2); // version
  i32(1); // original objects
  s4("YTlb"); s4("\0\0\0\0"); i32(1);
  s4("bptx"); i32(3); str(originalPathTex); i32(0); // modification id, type 3 = string, u1
  i32(1); // custom objects
  s4("YTlb"); s4("B000"); i32(2);
  s4("bptx"); i32(3); str(customPathTex); i32(0);
  s4("bptd"); i32(3); str(customPathTexDeath); i32(0);
  return new Uint8Array(out);
}

// --- 1. the .w3b is folded into a per-type column override --------------------------------
{
  const ov = mapDestructablePathing(w3b("", "PathTextures\\4x4Default.tga", ""));
  check("original object keyed by oldId", ov.get("YTlb")?.get("pathTex") === "", JSON.stringify([...ov]));
  check("custom object keyed by newId", ov.get("B000")?.get("pathTex") === "PathTextures\\4x4Default.tga");
  check("death texture override read too", ov.get("B000")?.get("pathTexDeath") === "");
  check("no .w3b = no overrides", mapDestructablePathing(undefined).size === 0);
}

// --- 2. the ring: stock footprint walls the plaza in, the map override opens it -----------
const SIZE = 40;
const STOCK = { YTlb: "PathTextures\\2x2Default.tga" };
// A 12×12 plaza cells 16..27 enclosed by 2×2 hedges tiling its border (the real layout:
// 64-unit spacing, 2×2 footprint, so neighbours exactly touch).
const ring = [];
for (let x = 16; x <= 26; x += 2) for (const y of [16, 26]) ring.push({ id: "YTlb", x: (x + 1) * PATHING_CELL, y: (y + 1) * PATHING_CELL, angle: (3 * Math.PI) / 2 });
for (let y = 18; y <= 24; y += 2) for (const x of [16, 26]) ring.push({ id: "YTlb", x: (x + 1) * PATHING_CELL, y: (y + 1) * PATHING_CELL, angle: (3 * Math.PI) / 2 });

function build(w3bBytes) {
  const grid = new PathingGrid({ width: SIZE, height: SIZE, flags: new Uint8Array(SIZE * SIZE) }, [0, 0]);
  const ov = mapDestructablePathing(w3bBytes);
  const pathTexOf = (id) => {
    const o = ov.get(id)?.get("pathTex");
    if (o !== undefined) return !o || o === "_" || o === "none" ? undefined : o;
    return STOCK[id];
  };
  const stamped = stampFootprints(grid, ring, pathTexOf, () => HEDGE);
  return { grid, stamped };
}
const inside = (g) => g.regionSize(21, 21);
{
  const stock = build(undefined);
  check("stock table stamps the hedge", stock.stamped === ring.length, `stamped ${stock.stamped}/${ring.length}`);
  check("…and the plaza is an island", stock.grid.walkable(5, 5) && inside(stock.grid) < SIZE * SIZE,
    `region ${inside(stock.grid)}`);
  check("…that cannot reach the outside", stock.grid.regionAt(21, 21) !== stock.grid.regionAt(5, 5));

  const fixed = build(w3b("", "", ""));
  check("map's bptx \"\" stamps nothing", fixed.stamped === 0, `stamped ${fixed.stamped}`);
  check("…so the plaza reaches the whole map", inside(fixed.grid) === SIZE * SIZE, `region ${inside(fixed.grid)}`);
}

if (failures) {
  console.error(`\nspawn island: ${failures} failure(s)`);
  process.exit(1);
}
console.log("spawn island: all checks passed");
