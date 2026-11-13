const fs = require("node:fs");
const path = require("node:path");

const BATCH = path.join(__dirname, "batches");
const TOOLS = path.join(__dirname, "..");

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function saveJSON(p, o) {
  fs.writeFileSync(p, `${JSON.stringify(o, null, 2)}\n`, "utf8");
}
function doneFiles(prefix) {
  return fs
    .readdirSync(BATCH)
    .filter((f) => f.startsWith("done-" + prefix) && f.endsWith(".json"))
    .map((f) => path.join(BATCH, f));
}

// 1) ability body skeletons -> dota-ability-body-zh.json
const abilityBody = loadJSON(path.join(TOOLS, "dota-ability-body-zh.json"));
let aAdded = 0;
for (const f of doneFiles("ability-")) {
  const d = loadJSON(f);
  for (const [k, v] of Object.entries(d)) {
    if (!(k in abilityBody)) aAdded++;
    abilityBody[k] = v;
  }
}
saveJSON(path.join(TOOLS, "dota-ability-body-zh.json"), abilityBody);

// 2) unit tips / bodies -> dota-unit-text-zh.json
const unitText = loadJSON(path.join(TOOLS, "dota-unit-text-zh.json"));
unitText.tips = unitText.tips || {};
unitText.bodies = unitText.bodies || {};
let tAdded = 0, bAdded = 0;
for (const f of doneFiles("unitTip-")) {
  const d = loadJSON(f);
  for (const [k, v] of Object.entries(d)) {
    if (!(k in unitText.tips)) tAdded++;
    unitText.tips[k] = v;
  }
}
for (const f of doneFiles("unitBody-")) {
  const d = loadJSON(f);
  for (const [k, v] of Object.entries(d)) {
    if (!(k in unitText.bodies)) bAdded++;
    unitText.bodies[k] = v;
  }
}
saveJSON(path.join(TOOLS, "dota-unit-text-zh.json"), unitText);

console.log(
  `merged: ability-body +${aAdded} (now ${Object.keys(abilityBody).length}), ` +
    `unit-tips +${tAdded} (now ${Object.keys(unitText.tips).length}), ` +
    `unit-bodies +${bAdded} (now ${Object.keys(unitText.bodies).length})`
);
