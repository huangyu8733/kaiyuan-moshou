// WC3 unit order IDs (Phase 7 — issue #33; see docs/triggers.md).
//
// The engine's OrderId(string) maps an order name to a stable integer the trigger
// API compares against — GUI code always writes `GetIssuedOrderId() == OrderId("attack")`,
// never a raw literal, so the exact numbers only need to be *self-consistent*. We still
// use the real engine constants where we know them: the generic movement/attack orders
// live in the 0x000D0000 block (base 851968), the well-known community values, so a
// hand-written script that hard-codes the literal (e.g. 851983) still matches.

/** The generic order strings the GUI point/target/immediate order actions emit. */
export const ORDER_IDS: Record<string, number> = {
  smart: 851971, // 0xD0003 — right-click default (move / attack / harvest / follow)
  stop: 851972, // 0xD0004
  attack: 851983, // 0xD000F
  attackground: 851984, // 0xD0010
  move: 851986, // 0xD0012
  patrol: 851990, // 0xD0016
  holdposition: 851993, // 0xD0019
};

/**
 * The ENGINE's own order table: every order string the game names, with the real integer it
 * answers to (`OrderId2String` / `OrderId`). Third-party maps rely on the numbers: DotA's
 * dummy-caster scaffolding does `IssueTargetOrderById(dummy, 852119, target)` ("chainlightning")
 * and compares `GetIssuedOrderId() == 852255` ("poisonarrows"). Without these the numeric form
 * translated to "" and the cast never reached the sim (no lightning, no on-hit damage).
 *
 * Source: WurstStdlib2 `_wurst/assets/Orders.wurst` (credited there to cJass's cj_order.j).
 * `moveAI` (851988) is spelled `moveai`, as the rest of this engine already names it.
 */
const ENGINE_ORDER_IDS: Readonly<Record<string, number>> = {
  moveai: 851988,
  absorb: 852529,
  acidbomb: 852662,
  acolyteharvest: 852185,
  ambush: 852131,
  ancestralspirit: 852490,
  ancestralspirittarget: 852491,
  animatedead: 852217,
  antimagicshell: 852186,
  attack: 851983,
  attackground: 851984,
  attackonce: 851985,
  attributemodskill: 852576,
  auraunholy: 852215,
  auravampiric: 852216,
  autodispel: 852132,
  autodispeloff: 852134,
  autodispelon: 852133,
  autoentangle: 852505,
  autoentangleinstant: 852506,
  autoharvestgold: 852021,
  autoharvestlumber: 852022,
  avatar: 852086,
  avengerform: 852531,
  awaken: 852466,
  banish: 852486,
  barkskin: 852135,
  barkskinoff: 852137,
  barkskinon: 852136,
  battleroar: 852599,
  battlestations: 852099,
  bearform: 852138,
  berserk: 852100,
  blackarrow: 852577,
  blackarrowoff: 852579,
  blackarrowon: 852578,
  blight: 852187,
  blink: 852525,
  blizzard: 852089,
  bloodlust: 852101,
  bloodlustoff: 852103,
  bloodluston: 852102,
  board: 852043,
  breathoffire: 852580,
  breathoffrost: 852560,
  build: 851994,
  burrow: 852533,
  cannibalize: 852188,
  carrionscarabs: 852551,
  carrionscarabsinstant: 852554,
  carrionscarabsoff: 852553,
  carrionscarabson: 852552,
  carrionswarm: 852218,
  chainlightning: 852119,
  channel: 852600,
  charm: 852581,
  chemicalrage: 852663,
  cloudoffog: 852473,
  clusterrockets: 852652,
  coldarrows: 852244,
  coldarrowstarg: 852243,
  controlmagic: 852474,
  corporealform: 852493,
  corrosivebreath: 852140,
  coupleinstant: 852508,
  coupletarget: 852507,
  creepanimatedead: 852246,
  creepdevour: 852247,
  creepheal: 852248,
  creephealoff: 852250,
  creephealon: 852249,
  creepthunderbolt: 852252,
  creepthunderclap: 852253,
  cripple: 852189,
  curse: 852190,
  curseoff: 852192,
  curseon: 852191,
  cyclone: 852144,
  darkconversion: 852228,
  darkportal: 852229,
  darkritual: 852219,
  darksummoning: 852220,
  deathanddecay: 852221,
  deathcoil: 852222,
  deathpact: 852223,
  decouple: 852509,
  defend: 852055,
  detectaoe: 852015,
  detonate: 852145,
  devour: 852104,
  devourmagic: 852536,
  disassociate: 852240,
  disenchant: 852495,
  dismount: 852470,
  dispel: 852057,
  divineshield: 852090,
  doom: 852583,
  drain: 852487,
  dreadlordinferno: 852224,
  dropitem: 852001,
  drunkenhaze: 852585,
  earthquake: 852121,
  eattree: 852146,
  elementalfury: 852586,
  ensnare: 852106,
  ensnareoff: 852108,
  ensnareon: 852107,
  entangle: 852147,
  entangleinstant: 852148,
  entanglingroots: 852171,
  etherealform: 852496,
  evileye: 852105,
  faeriefire: 852149,
  faeriefireoff: 852151,
  faeriefireon: 852150,
  fanofknives: 852526,
  farsight: 852122,
  fingerofdeath: 852230,
  firebolt: 852231,
  flamestrike: 852488,
  flamingarrows: 852174,
  flamingarrowstarg: 852173,
  flamingattack: 852540,
  flamingattacktarg: 852539,
  flare: 852060,
  forceboard: 852044,
  forceofnature: 852176,
  forkedlightning: 852587,
  freezingbreath: 852195,
  frenzy: 852561,
  frenzyoff: 852563,
  frenzyon: 852562,
  frostarmor: 852225,
  frostarmoroff: 852459,
  frostarmoron: 852458,
  frostnova: 852226,
  getitem: 851981,
  gold2lumber: 852233,
  grabtree: 852511,
  harvest: 852018,
  heal: 852063,
  healingspray: 852664,
  healingward: 852109,
  healingwave: 852501,
  healoff: 852065,
  healon: 852064,
  hex: 852502,
  holdposition: 851993,
  holybolt: 852092,
  howlofterror: 852588,
  humanbuild: 851995,
  immolation: 852177,
  impale: 852555,
  incineratearrow: 852670,
  incineratearrowoff: 852672,
  incineratearrowon: 852671,
  inferno: 852232,
  innerfire: 852066,
  innerfireoff: 852068,
  innerfireon: 852067,
  instant: 852200,
  invisibility: 852069,
  lavamonster: 852667,
  lightningshield: 852110,
  load: 852046,
  loadarcher: 852142,
  loadcorpse: 852050,
  loadcorpseinstant: 852053,
  locustswarm: 852556,
  lumber2gold: 852234,
  magicdefense: 852478,
  magicleash: 852480,
  magicundefense: 852479,
  manaburn: 852179,
  manaflareoff: 852513,
  manaflareon: 852512,
  manashieldoff: 852590,
  manashieldon: 852589,
  massteleport: 852093,
  mechanicalcritter: 852564,
  metamorphosis: 852180,
  militia: 852072,
  militiaconvert: 852071,
  militiaoff: 852073,
  militiaunconvert: 852651,
  mindrot: 852565,
  mirrorimage: 852123,
  monsoon: 852591,
  mount: 852469,
  mounthippogryph: 852143,
  move: 851986,
  nagabuild: 852467,
  neutraldetectaoe: 852023,
  neutralinteract: 852566,
  neutralspell: 852630,
  nightelfbuild: 851997,
  orcbuild: 851996,
  parasite: 852601,
  parasiteoff: 852603,
  parasiteon: 852602,
  patrol: 851990,
  phaseshift: 852514,
  phaseshiftinstant: 852517,
  phaseshiftoff: 852516,
  phaseshifton: 852515,
  phoenixfire: 852481,
  phoenixmorph: 852482,
  poisonarrows: 852255,
  poisonarrowstarg: 852254,
  polymorph: 852074,
  possession: 852196,
  preservation: 852568,
  purge: 852111,
  rainofchaos: 852237,
  rainoffire: 852238,
  raisedead: 852197,
  raisedeadoff: 852199,
  raisedeadon: 852198,
  ravenform: 852155,
  recharge: 852157,
  rechargeoff: 852159,
  rechargeon: 852158,
  rejuvination: 852160,
  renew: 852161,
  renewoff: 852163,
  renewon: 852162,
  repair: 852024,
  repairoff: 852026,
  repairon: 852025,
  replenish: 852542,
  replenishlife: 852545,
  replenishlifeoff: 852547,
  replenishlifeon: 852546,
  replenishmana: 852548,
  replenishmanaoff: 852550,
  replenishmanaon: 852549,
  replenishoff: 852544,
  replenishon: 852543,
  request_hero: 852239,
  requestsacrifice: 852201,
  restoration: 852202,
  restorationoff: 852204,
  restorationon: 852203,
  resumebuild: 851999,
  resumeharvesting: 852017,
  resurrection: 852094,
  returnresources: 852020,
  revenge: 852241,
  revive: 852039,
  roar: 852164,
  robogoblin: 852656,
  root: 852165,
  sacrifice: 852205,
  sanctuary: 852569,
  scout: 852181,
  selfdestruct: 852040,
  selfdestructoff: 852042,
  selfdestructon: 852041,
  sentinel: 852182,
  setrally: 851980,
  shadowsight: 852570,
  shadowstrike: 852527,
  shockwave: 852125,
  silence: 852592,
  sleep: 852227,
  slow: 852075,
  slowoff: 852077,
  slowon: 852076,
  smart: 851971,
  soulburn: 852668,
  soulpreservation: 852242,
  spellshield: 852571,
  spellshieldaoe: 852572,
  spellsteal: 852483,
  spellstealoff: 852485,
  spellstealon: 852484,
  spies: 852235,
  spiritlink: 852499,
  spiritofvengeance: 852528,
  spirittroll: 852573,
  spiritwolf: 852126,
  stampede: 852593,
  standdown: 852113,
  starfall: 852183,
  stasistrap: 852114,
  steal: 852574,
  stomp: 852127,
  stoneform: 852206,
  stop: 851972,
  submerge: 852604,
  summonfactory: 852658,
  summongrizzly: 852594,
  summonphoenix: 852489,
  summonquillbeast: 852595,
  summonwareagle: 852596,
  tankdroppilot: 852079,
  tankloadpilot: 852080,
  tankpilot: 852081,
  taunt: 852520,
  thunderbolt: 852095,
  thunderclap: 852096,
  tornado: 852597,
  townbelloff: 852083,
  townbellon: 852082,
  tranquility: 852184,
  transmute: 852665,
  unavatar: 852087,
  unavengerform: 852532,
  unbearform: 852139,
  unburrow: 852534,
  uncoldarrows: 852245,
  uncorporealform: 852494,
  undeadbuild: 851998,
  undefend: 852056,
  undivineshield: 852091,
  unetherealform: 852497,
  unflamingarrows: 852175,
  unflamingattack: 852541,
  unholyfrenzy: 852209,
  unimmolation: 852178,
  unload: 852047,
  unloadall: 852048,
  unloadallcorpses: 852054,
  unloadallinstant: 852049,
  unpoisonarrows: 852256,
  unravenform: 852156,
  unrobogoblin: 852657,
  unroot: 852166,
  unstableconcoction: 852500,
  unstoneform: 852207,
  unsubmerge: 852605,
  unsummon: 852210,
  unwindwalk: 852130,
  vengeance: 852521,
  vengeanceinstant: 852524,
  vengeanceoff: 852523,
  vengeanceon: 852522,
  volcano: 852669,
  voodoo: 852503,
  ward: 852504,
  waterelemental: 852097,
  wateryminion: 852598,
  web: 852211,
  weboff: 852213,
  webon: 852212,
  whirlwind: 852128,
  windwalk: 852129,
  wispharvest: 852214,
};

/** String → id, seeded with the engine's real table (the generic seven included). */
const NAME_TO_ID = new Map<string, number>(Object.entries(ENGINE_ORDER_IDS));
/** Id → string, the reverse: a minted ability order joins it on first sight. */
const ID_TO_STRING = new Map<number, string>();
for (const [name, id] of NAME_TO_ID) ID_TO_STRING.set(id, name);
for (const [name, id] of Object.entries(ORDER_IDS)) {
  NAME_TO_ID.set(name, id);
  ID_TO_STRING.set(id, name);
}

// --- ability orders (7.17) ---------------------------------------------------
// Every castable ability has its own order string (AbilityFunc `Order=holybolt`), and
// the GUI's "Unit - Order <unit> to <ability>" compiles to
// `IssueTargetOrder(u, "holybolt", target)`. Every order the engine itself knows is in
// ENGINE_ORDER_IDS above, so the string and the number agree (`OrderId("chainlightning")
// == 852119`, and `IssueTargetOrderById(u, 852119, t)` reaches the sim as "chainlightning").
// Only a string the engine's table does not name — a map's private order vocabulary — is
// MINTED on first sight, in a private block above the generic ones: self-consistency is what
// matters there (`GetIssuedOrderId() == OrderId("<that string>")` holds, and the bridge carries
// the STRING alongside the id, so the cast does not depend on the number at all).
const ABILITY_ORDER_BASE = 0x000e0000; // 917504 — clear of the 0xD block
let nextAbilityOrderId = ABILITY_ORDER_BASE;
const MINTED = new Map<string, number>();

/** OrderId / String2OrderId — name → integer id. An order the engine names keeps its real
 *  engine id; any other non-empty string gets a minted, stable id (see ABILITY_ORDER_BASE). */
export function orderStringToId(s: string): number {
  const name = s.trim().toLowerCase();
  if (!name) return 0;
  const real = NAME_TO_ID.get(name);
  if (real !== undefined) return real;
  let id = MINTED.get(name);
  if (id === undefined) {
    id = nextAbilityOrderId++;
    MINTED.set(name, id);
    ID_TO_STRING.set(id, name);
  }
  return id;
}
// --- which strings ARE orders --------------------------------------------------------------
// `OrderId("footman")` is 0 in the game: a unit's NAME is not an order string, and blizzard.j's
// String2OrderIdBJ says so by falling back on `UnitId` when OrderId answers 0 ("Check to see if
// it's a (train) unit order"). Minting an id for every string made that fallback unreachable.
// So the OrderId NATIVE answers only for a string that is an order somewhere in the data — an
// ability's `Order`/`Orderon`/`Orderoff`/`Unorder`, or one of `UI\TriggerData.txt`'s
// `UnitOrder…` strings — and 0 for anything else. The ISSUE paths still mint (a script's order
// must reach the unit whatever it spells), and a string one of them has already minted keeps
// its id here too, so the two can never disagree about an order that was actually given.
const VOCABULARY = new Set<string>();

/**
 * The ENGINE's orders that no data file names — real order strings (each has an order id and a
 * string in the game) that are neither an ability's `Order` column nor a TriggerData `UnitOrder`:
 * the Acolyte's `acolyteharvest`, the worker's `resumeharvesting`, the inventory's `getitem` /
 * `dropitem`, a toggle's other half (`unwindwalk`, `barkskinoff`). The list is the difference
 * between that vocabulary and the table of every order that HAS a string counterpart in
 * WurstStdlib2's `_wurst/assets/Orders.wurst` (class `OrderIds`, credited there to cJass's
 * cj_order.j) — names only. DotA's AI asks for `OrderId("acolyteharvest")`, the one corpus call
 * the data alone would have answered 0.
 */
const ENGINE_ORDERS: ReadonlySet<string> = new Set([
  "acolyteharvest", "ancestralspirittarget", "auraunholy", "auravampiric", "barkskin",
  "barkskinoff", "barkskinon", "blight", "coupletarget", "detectaoe", "disassociate", "dropitem",
  "ensnareoff", "ensnareon", "flamingarrowstarg", "getitem", "gold2lumber", "loadcorpseinstant",
  "lumber2gold", "mechanicalcritter", "militiaconvert", "militiaunconvert", "moveai",
  "neutraldetectaoe", "neutralinteract", "neutralspell", "phaseshiftinstant", "phoenixfire",
  "phoenixmorph", "preservation", "rainofchaos", "request_hero", "resumebuild", "resumeharvesting",
  "sanctuary", "shadowsight", "spellshield", "spellshieldaoe", "spies", "spirittroll", "steal",
  "tankdroppilot", "tankloadpilot", "tankpilot", "unavatar", "unavengerform", "unloadallinstant",
  "unwindwalk", "wispharvest",
]);

/** Teach the order vocabulary (the ability registry's order strings, TriggerData's list). */
export function learnOrderStrings(strings: Iterable<string>): void {
  for (const s of strings) {
    const name = s.trim().toLowerCase();
    if (name) VOCABULARY.add(name);
  }
}

/** The `OrderId` / `String2OrderId` natives: an engine order's real id, a map-private ability
 *  order's minted one, and 0 for a string that is no order at all (see VOCABULARY). With no
 *  vocabulary taught (a headless interpreter with no data behind it) every string is taken as
 *  an order, as before. */
export function orderIdOf(s: string): number {
  const name = s.trim().toLowerCase();
  if (!name) return 0;
  if (NAME_TO_ID.has(name) || MINTED.has(name) || !VOCABULARY.size || VOCABULARY.has(name) || ENGINE_ORDERS.has(name)) {
    return orderStringToId(name);
  }
  return 0;
}

/** OrderId2String — integer id → name ("" if unknown). */
export function orderIdToString(id: number): string {
  return ID_TO_STRING.get(id) ?? "";
}
/** Is this a minted ability-order id (not one of the generic movement/attack orders)? */
export function isAbilityOrder(id: number): boolean {
  return id >= ABILITY_ORDER_BASE;
}
