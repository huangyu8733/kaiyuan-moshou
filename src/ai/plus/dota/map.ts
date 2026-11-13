// Computer+ on DotA v6.83d — the MAP, as the AI needs to know it.
//
// Everything here is read off the map's own `scripts\war3map.j` (3,167,858 bytes). The map is
// protected and its globals are obfuscated, so the identifying constants are the names its
// `globals` block declares — not the file name, which a copy in the Download folder changes.
//
// What the script says about a computer seat (and therefore what this AI works around):
//
//  · `T3I(p)` is `GetPlayerController(p) == MAP_CONTROL_USER`, and it is the gate on the whole
//    hero picker: `X12`/`X22` (the init at 36541-36596) stocks each player's Circle of Power
//    (`D30[player]`, rawcode `ncop`) with three heroes and gives it the sell abilities ONLY
//    when `T3I(p)` holds. A computer seat on this map therefore owns a Circle of Power with
//    nothing on its shelf, and would stand there for the whole match.
//  · The ordinary picker is the NEUTRAL taverns in each base: their standard `Sellunits` shelves
//    are the game data's (6.83d ships no `war3map.w3u`), so a `train` there is exactly a person's
//    click, and `QP1` — "a hero entered the playable area" — moves it to the fountain and records
//    it in `K1[player]`. No controller test on that path. In the map's Single Draft the same shelf
//    is the seat's own Circle of Power (`AddUnitToStock` in `X12`/`X22`), which is the only reason
//    `T3I` matters here: a computer seat would get no stock.
//  · The 24 picker statues (`QA0[1..24]`, owned by Player(13), sold to the arena) go through
//    `K52` → `JR2`, whose first line is `if T3I(p) == false then return` — that path is for
//    people, and this AI never needs it.
//
// So DotA's computers are seated as PLAYERS to the script (`MapViewerScene.runMapScript`'s
// `onBoot`, the same seam Candy War uses) and then shop at those taverns like a person.

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/**
 * Scalar globals declared by DotA v6.83d's `globals` block (lines 1772-1794): the picker-sale
 * trigger, the picker circle's centre, and the two init flags. A script carrying all five is this
 * map's build; the AI maps with their own `war3map.j` (6.80 AI, 6.90G) do not, which is what keeps
 * this AI off them.
 */
export const DOTA_SCRIPT_MARKERS = ["U20", "QV0", "QW0", "TP0", "RU0"] as const;

export function isDotAScript(globals: { has(name: string): boolean }): boolean {
  return DOTA_SCRIPT_MARKERS.every((g) => globals.has(g));
}

/**
 * The ten hero seats. `BO[1..5]` are Player(1..5) and `CO[1..5]` are Player(7..11) (7432-7443,
 * with `BO[0]`/`CO[0]` reassigned to the two Neutral Passives at 8327-8328). Player(0) and
 * Player(6) are the two teams' force seats and never hold a hero.
 */
export const HERO_SEATS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 7, 8, 9, 10, 11]);

export type Side = "sentinel" | "scourge";

export function sideOf(player: number): Side | null {
  if (player >= 1 && player <= 5) return "sentinel";
  if (player >= 7 && player <= 11) return "scourge";
  return null;
}

export function enemySide(side: Side): Side {
  return side === "sentinel" ? "scourge" : "sentinel";
}

/** The hero-picker shop every player owns: their `ncop` Circle of Power (`D30`). */
export const PICKER_TYPE = "ncop";
