// TEMP: cast Earthshaker's (Otch) abilities against the real DotA 6.83d row data in a headless
// sim and record which effect models the sim emits.
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

const grid = new PathingGrid({ width: 128, height: 128, flags: new Uint8Array(128 * 128) }, [0, 0]);
const world = new SimWorld(grid, 1, abilities, undefined, unitReg);

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
const abList = ["A0DH", "A0DL", "A0SK", "A0DJ"].map((id) => ({ id, code: abilities.get(id).code, level: 3, cooldownLeft: 0, autocastOn: false }));

world.initStash(0, 0, 0);
const hero = world.add(base({ id: 1, typeId: "Otch", x: 1000, y: 1000, hp: 1500, maxHp: 1500, mana: 800, maxMana: 800, castPoint: 0.3 }), null, { abilities: abList });
const victim = world.add(base({ id: 2, typeId: "hfoo", owner: 1, team: 1, x: 1100, y: 1000, hp: 1000, maxHp: 1000 }), null, {});


function cast(code) {
  world.drainSpellEffects();
  const ok = world.issueCast(1, code, 0, 1100, 1000);
  let out = [];
  for (let i = 0; i < 60; i++) {
    world.tick(0.05);
    out.push(...world.drainSpellEffects());
  }
  console.log(`\n== ${code} issueCast=${ok} effects=${out.length}`);
  for (const e of out) console.log("   ", e.art, "@", Math.round(e.x), Math.round(e.y), "target", e.targetId);
}


cast("A0SK");
console.log("pc", world.pendingCasts && world.pendingCasts.get(1));
console.log("\nvictim hp", victim.hp, "hero mana", hero.mana);
