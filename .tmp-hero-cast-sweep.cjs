// TEMP AUDIT: cast every non-passive ability of every hero in a DotA map in the headless sim and
// record whether anything was DRAWN (spell effects emitted) and whether it did anything at all.
// Rows that are cast successfully but emit no art are the "invisible skill" candidates.
const { join } = require("node:path");
const fs = require("node:fs");
const REPO = __dirname;
const B = (...p) => require(join(REPO, ".sim-build", "src", ...p));
const { SimWorld } = B("sim", "world.js");
const { PathingGrid } = B("sim", "pathing.js");
const { MapTableSource } = B("vfs", "mapTables.js");
const { loadAbilityRegistry } = B("data", "abilities.js");
const { loadUnitRegistry } = B("data", "units.js");

const EXTRACT = join(REPO, "Warcraft III zhCN", "ExtractedData", "merged");
function resolver(root) {
  return {
    rawBytes(p) {
      let dir = root;
      for (const part of p.split("\\")) {
        if (!part) continue;
        let hit;
        try { hit = fs.readdirSync(dir).find((n) => n.toLowerCase() === part.toLowerCase()); } catch { return null; }
        if (!hit) return null;
        dir = join(dir, hit);
      }
      try { return new Uint8Array(fs.readFileSync(dir)); } catch { return null; }
    },
    exists(p) {
      let dir = root;
      for (const part of p.split("\\")) {
        if (!part) continue;
        let hit;
        try { hit = fs.readdirSync(dir).find((n) => n.toLowerCase() === part.toLowerCase()); } catch { return false; }
        if (!hit) return false;
        dir = join(dir, hit);
      }
      return true;
    },
    list: () => [],
  };
}
const install = resolver(EXTRACT);

const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;
const archive = new Archive();
archive.load(fs.readFileSync(process.argv[2]).buffer);
const mapSrc = {
  exists: (p) => !!archive.get(p),
  rawBytes: (p) => {
    const f = archive.get(p);
    if (!f) return null;
    const b = f.bytes();
    return b instanceof Uint8Array ? b : new Uint8Array(b);
  },
  read: async (p) => mapSrc.rawBytes(p),
  list: () => archive.getFileNames(),
};

const tables = new MapTableSource(install);
loadUnitRegistry(tables);
loadAbilityRegistry(tables);
tables.shadows(mapSrc);
tables.setMap(mapSrc);
const abilities = loadAbilityRegistry(tables);
const unitReg = loadUnitRegistry(tables);

const ART = ["casterArt", "effectArt", "targetArt", "missileArt", "specialArt", "buffArt"];
const base = (over) => ({
  owner: 0, team: 0, facing: 0, mana: 0, maxMana: 0, hpRegen: 0, turnRate: 0.6, scale: 1,
  armor: 0, armorType: "medium", defUp: 0, weapon: null, weapons: [], oldWeapons: [],
  sight: 1400, nsight: 800, baseSight: 1400, sightDay: 1400, sightNight: 800, flying: false,
  mechanical: false, invulnerable: false, race: "orc", isBuilding: false, foodCost: 0,
  goldCost: 0, lumberCost: 0, abilities: [], upgrades: [], moveType: "foot", collisionSize: 16, radius: 16,
  canFlee: true, targetedAs: "ground", deathTime: 2, name: "", worker: null,
  depotGold: false, depotLumber: false, castPoint: 0, castBackswing: 0,
  ...over,
});

const results = [];
for (const u of unitReg.all()) {
  if (!u.isHero) continue;
  const rows = [...new Set([...(u.heroAbilities || []), ...(u.abilities || [])])]
    .map((id) => abilities.get(id))
    .filter((d) => d && d.target !== "passive" && d.levelData && d.levelData.length)
    .map((d) => d);
  if (!rows.length) continue;

  const grid = new PathingGrid({ width: 128, height: 128, flags: new Uint8Array(128 * 128) }, [0, 0]);
  const world = new SimWorld(grid, 1, abilities, undefined, unitReg);
  const abList = rows.map((d) => ({ id: d.id, code: d.code, level: Math.max(1, Math.min(3, d.levelData.length)), cooldownLeft: 0, autocastOn: false }));
  world.initStash(0, 0, 0);
  const hero = world.add(base({ id: 1, typeId: u.id, x: 1090, y: 1000, hp: 100000, maxHp: 100000, mana: 100000, maxMana: 100000, castPoint: 0 }), null, { abilities: abList });
  const victim = world.add(base({ id: 2, typeId: "hfoo", owner: 1, team: 1, x: 1120, y: 1000, hp: 100000, maxHp: 100000 }), null, {});
  const mate = world.add(base({ id: 3, typeId: "hfoo", owner: 0, team: 0, x: 1120, y: 1040, hp: 100000, maxHp: 100000 }), null, {});

  for (const d of rows) {
    world.drainSpellEffects();
    let ok = false, on = "enemy";
    if (d.target === "unit") {
      ok = world.issueCast(1, d.id, 2, victim.x, victim.y);
      if (!ok) { ok = world.issueCast(1, d.id, 3, mate.x, mate.y); on = "friend"; }
      if (!ok) { ok = world.issueCast(1, d.id, 1, hero.x, hero.y); on = "self"; }
    } else {
      ok = world.issueCast(1, d.id, 0, 1120, 1000);
      on = "point";
    }
    const arts = [];
    let dmg = 0;
    const before = victim.hp;
    let err = "";
    let proj = 0, bolts = 0, splats = 0;
    try {
      for (let i = 0; i < 160; i++) {
        world.tick(0.05);
        arts.push(...world.drainSpellEffects());
        proj += world.drainSpawnedProjectiles().length;
        bolts += world.drainSpellLightnings().length;
        splats += world.drainSpellSplats().length;
        world.drainProjectileImpacts();
        world.drainLightningStops();
      }
    } catch (e) { err = String(e.message || e); }
    dmg = before - victim.hp;
    const art = ART.filter((f) => (d[f] || "").trim());
    results.push({ hero: u.id, name: u.name, id: d.id, code: d.code, order: d.order || "-", target: d.target, cast: ok, on, n: arts.length, arts: [...new Set(arts.map((e) => String(e.art)))], art, dmg, proj, bolts, splats, err, name2: d.name || "" });
  }
}

const silent = results.filter((r) => r.cast && r.n === 0 && !r.proj && !r.bolts && !r.splats && r.art.length && !r.err);
console.log(`total casts=${results.length}  silent-with-art=${silent.length}  errors=${results.filter((r) => r.err).length}`);
console.log("\n---- successes that threw ----");
for (const r of results.filter((r) => r.err)) console.log(`  ${r.id} ${r.code} r${"3"} | ${r.hero} ${r.name} / ${r.name2} :: ${r.err}`);
console.log("\n---- successful cast, zero effects, row has art ----");
for (const r of silent.sort((a, b) => a.code.localeCompare(b.code))) {
  console.log(`  ${r.id} ${r.code.padEnd(5)} ${String(r.order).padEnd(14)} ${String(r.target).padEnd(7)} row=[${r.art.join(",")}] dmg=${r.dmg} on=${r.on} | ${r.hero} ${r.name} / ${r.name2}`);}
console.log("\n---- refused/no-art rows grouped by code ----");
const byCode = {};
for (const r of results) {
  if (r.n > 0) continue;
  const k = r.code;
  byCode[k] = byCode[k] || { cast: 0, refused: 0, tot: 0 };
  byCode[k].tot++;
  if (r.cast) byCode[k].cast++; else byCode[k].refused++;
}
for (const [k, v] of Object.entries(byCode).sort()) console.log(`  ${k.padEnd(5)} rows=${v.tot} cast=${v.cast} refused=${v.refused}`);
