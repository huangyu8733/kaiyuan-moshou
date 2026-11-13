// TEMP: what the engine's ability registry sees for Earthshaker's (Otch) abilities when the
// DotA map's own tables are laid over the install's.
const { join } = require("node:path");
const fs = require("node:fs");
const REPO = __dirname;
const B = (...p) => require(join(REPO, ".sim-build", "src", ...p));
const { MapTableSource } = B("vfs", "mapTables.js");
const { loadAbilityRegistry } = B("data", "abilities.js");
const { loadUnitRegistry } = B("data", "units.js");

const EXTRACT = join(REPO, "Warcraft III zhCN", "ExtractedData", "merged");
const install = {
  label: "install",
  rawBytes(p) {
    let dir = EXTRACT;
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
    let dir = EXTRACT;
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

const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;
const W3A = require("mdx-m3-viewer/dist/cjs/parsers/w3x/w3u/file").default;

const mapPath = process.argv[2];
const archive = new Archive();
archive.load(fs.readFileSync(mapPath).buffer);
const mapSrc = {
  label: "map",
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
loadAbilityRegistry(tables); // fills `asked`
const shadowed = tables.shadows(mapSrc);
console.log("shadowed tables:", shadowed.length);
tables.setMap(mapSrc);
const abilities = loadAbilityRegistry(tables);
const units = loadUnitRegistry(tables);

const otch = units.get("Otch");
console.log("\nOtch:", otch && { name: otch.name, heroAbilities: otch.heroAbilities, abilities: otch.abilities, properNames: otch.properNames });

for (const id of ["A0DH", "A0DL", "A0SK", "A0DJ", "A0DI", "Aamk"]) {
  const a = abilities.get(id);
  if (!a) { console.log(`\n${id}: NOT FOUND`); continue; }
  console.log(`\n${id}`, {
    name: a.name, code: a.code, target: a.target, race: a.race,
    missileArt: a.missileArt, missileSpeed: a.missileSpeed,
    casterArt: a.casterArt, targetArt: a.targetArt, effectArt: a.effectArt,
    specialArt: a.specialArt, areaArt: a.areaArt, buffArt: a.buffArt,
    lightning: a.lightning,
    levels: a.levelData.map((l) => ({ cooldown: l.cooldown, mana: l.cost, castRange: l.castRange, area: l.area, duration: l.duration, castTime: l.castTime, data: l.data, buffs: l.buffs, summon: l.summon })),
    targs: a.targetFlags,
  });
}
