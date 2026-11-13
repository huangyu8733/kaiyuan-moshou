// Headless check of Computer+ on DotA v6.83d (src/ai/plus/dota/).
// Run: npx tsc -p tools/tsconfig.sim.json && node tools/ai-plus-dota-test.cjs
//
// Pinned here, because each one breaks silently in a running match:
//
//  1. **The map is recognised by its own script**, and an AI map is not — the whole point of the
//     user's "6.83d and 6.90G must not interfere": 6.90G ships its own AI and must never be seated
//     by this one.
//  2. **The hero is HIRED, not created** — one ordinary `train` on the seat's own Circle of Power,
//     with a hero that shop actually stocks. That is the door a person's click goes through.
//  3. **It leaves the base** — with a hero and no enemy nearby it attack-moves at the other side's
//     base.
//  4. **It goes home when hurt**, and asks for nothing while dead (the map revives).
const { join } = require("node:path");
const REPO = join(__dirname, "..");
require("node:fs").writeFileSync(join(REPO, ".sim-build", "package.json"), '{"type":"commonjs"}');
const map = require(join(REPO, ".sim-build", "src", "ai", "plus", "dota", "map.js"));
const { DotaAi } = require(join(REPO, ".sim-build", "src", "ai", "plus", "dota", "index.js"));

let failed = 0;
function check(what, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) console.log(`        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
}

const HERO_TYPES = new Set(["Hvwd", "Hmbr", "Emoo"]);
const registry = { get: (id) => ({ isHero: HERO_TYPES.has(id) }) };

function makeWorld(units, wares) {
  const m = new Map(units.map((u) => [u.id, Object.assign({ isHero: false, hp: 1, maxHp: 1, building: undefined }, u)]));
  return { units: m, shopWaresOf: (id) => ({ items: [], units: wares[id] ?? [] }) };
}

function makeHost(world) {
  const cmds = [];
  const host = {
    cmds,
    world,
    registry,
    execute: (player, cmd) => { cmds.push({ player, cmd }); return true; },
    // Neutral Passive (13/14) serves both sides, as it does in the match.
    coAllied: (a, b) => a === b || a === 13 || a === 14 || b === 13 || b === 14,
  };
  return host;
}

const ownCop = { id: 1, owner: 1, typeId: "ncop", hp: 100, x: -7000, y: 6900, building: {} };
const foeCop = { id: 3, owner: 7, typeId: "ncop", hp: 100, x: 7000, y: -6900, building: {} };

// --- 1. recognition ----------------------------------------------------------------------------
const dotaGlobals = (names) => ({ has: (n) => names.includes(n) });
check("6.83d's script is recognised", map.isDotAScript(dotaGlobals([...map.DOTA_SCRIPT_MARKERS])), true);
check("a script missing one marker is not", map.isDotAScript(dotaGlobals(map.DOTA_SCRIPT_MARKERS.slice(1))), false);
check("an AI map with its own triggers is not", map.isDotAScript(dotaGlobals(["gg_trg_Hear", "gg_trg_Pick_Heroes", "gg_trg_Crate_Detection_North", "gg_trg_Crate_Detection_Middle", "gg_trg_Crate_Detection_South"])), false);
check("everything else is not", map.isDotAScript(dotaGlobals(["bj_cineModeAlreadyIn"])), false);

// --- seats --------------------------------------------------------------------------------------
check("the ten hero seats", [...map.HERO_SEATS], [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]);
check("Player(1) is a Sentinel", map.sideOf(1), "sentinel");
check("Player(11) is Scourge", map.sideOf(11), "scourge");
check("Player(0) is no hero seat", map.sideOf(0), null);
check("Player(6) is no hero seat", map.sideOf(6), null);
check("sides face each other", [map.enemySide("sentinel"), map.enemySide("scourge")], ["scourge", "sentinel"]);

// --- 2. it hires a hero off its own Circle of Power --------------------------------------------
{
  const world = makeWorld([ownCop], { 1: ["Hmbr", "Hvwd", "Emoo"] });
  const host = makeHost(world);
  const ai = new DotaAi(host);
  ai.add(1, 1, 1);
  ai.tick(1);
  check("a seat with no hero hires one", host.cmds[0], { player: 1, cmd: { c: "train", buildingId: 1, unitId: "Hmbr" } });
}
{
  // A shelf with no hero on it (what a computer seat owned before the controller fix) hires nothing.
  const world = makeWorld([ownCop], { 1: [] });
  const host = makeHost(world);
  const ai = new DotaAi(host);
  ai.add(1, 1, 1);
  ai.tick(1);
  check("an empty shelf hires nothing", host.cmds.length, 0);
}
{
  // Not a hero seat: never seated at all.
  const ai = new DotaAi(makeHost(makeWorld([], {})));
  ai.add(0, 1, 1);
  check("a force seat is never seated", ai.active, false);
}
{
  // The ordinary picker is a NEUTRAL tavern, not the seat's own Circle of Power: the AI asks it
  // just the same, because that is the shop a person clicks.
  const tavern = { id: 9, owner: 13, typeId: "nngt", hp: 100, x: -7400, y: 6800, building: {} };
  const world = makeWorld([tavern], { 9: ["Hmbr"] });
  const host = makeHost(world);
  const ai = new DotaAi(host);
  ai.add(1, 1, 1);
  ai.tick(1);
  check("a neutral tavern serves the seat too", host.cmds[0], { player: 1, cmd: { c: "train", buildingId: 9, unitId: "Hmbr" } });
}

// --- 3. it leaves the base ---------------------------------------------------------------------
{
  const hero = { id: 2, owner: 1, typeId: "Hmbr", isHero: true, hp: 1000, maxHp: 1000, x: -7000, y: 6900 };
  const world = makeWorld([ownCop, foeCop, hero], { 1: ["Hmbr"] });
  const host = makeHost(world);
  const ai = new DotaAi(host);
  ai.add(1, 1, 1);
  ai.tick(1);
  check("with a hero it pushes at the other base", host.cmds[0], {
    player: 1,
    cmd: { c: "order", unitId: 2, order: { kind: "attackmove", x: 7000, y: -6900 }, queued: false },
  });
}

// --- 4. it goes home when hurt, and asks for nothing while dead --------------------------------
{
  const hero = { id: 2, owner: 1, typeId: "Hmbr", isHero: true, hp: 50, maxHp: 1000, x: 0, y: 0 };
  const world = makeWorld([ownCop, foeCop, hero], { 1: ["Hmbr"] });
  const host = makeHost(world);
  const ai = new DotaAi(host);
  ai.add(1, 1, 1);
  ai.tick(1);
  check("a hurt hero goes home", host.cmds[0], {
    player: 1,
    cmd: { c: "order", unitId: 2, order: { kind: "move", x: -7000, y: 6900 }, queued: false },
  });
}
{
  const corpse = { id: 2, owner: 1, typeId: "Hmbr", isHero: true, hp: 0, maxHp: 1000, x: 0, y: 0 };
  const world = makeWorld([ownCop, foeCop, corpse], { 1: ["Hmbr"] });
  const host = makeHost(world);
  const ai = new DotaAi(host);
  ai.add(1, 1, 1);
  ai.tick(1);
  check("a dead hero is left to the map's revive", host.cmds.length, 0);
}

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
