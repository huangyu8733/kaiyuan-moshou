import type { PlusHost } from "../index";
import type { SimUnit } from "../../../sim/world";
import { plusProfile, type PlusProfile } from "../profile";
import { HERO_SEATS, PICKER_TYPE, sideOf, type Pt, type Side } from "./map";

// Computer+ on DotA v6.83d (src/ai/plus/dota/map.ts has the map's own evidence).
//
// The map has no AI of its own — its script never calls `StartMeleeAI`, and the hero picker only
// stocks a seat whose controller is `MAP_CONTROL_USER`. The scene therefore tells the script its
// computer seats are players before init (`MapViewerScene.runMapScript`'s `onBoot`), which makes
// the map hand each of them the same Circle of Power a person gets, with three heroes on its
// shelf. From there this plays the seat the way a person does, and only through `PlusHost.execute`
// — the same door, the same gold, food and technology checks:
//
//  1. HIRE a hero off the shops the map puts in front of this seat — the NEUTRAL picker taverns
//     that line every DotA base, or the seat's own Circle of Power in the map's Single Draft.
//     Either way it is one ordinary `train`, and the map's own sale/arrival handlers place the
//     hero at the fountain.
//  2. PUSH: once it has a hero, attack-move towards the other side's base. The map's lanes lead
//     there, and the pathfinder picks the way round the trees.
//  3. GO HOME when the hero is hurt (the fountain heals) and set out again once it is whole.
//  4. WAIT while dead — the map revives its heroes itself; the AI never creates one.
//
// v1 deliberately stops there: no last-hitting, no item build, no skill order, no lane split.
// Difficulty only changes how fast it re-aims and how hurt it lets itself get before going home,
// read off `plusProfile` like every other Computer+ brain.

/** Seconds between two attempts to hire (a refusal is usually no gold yet). */
const HIRE_RETRY = 2;
/** Seconds before the same move/attack-move order is repeated. */
const ORDER_REFRESH = 2.5;
/** A hero this whole goes back out — the fountain has done its work. */
const HOME_HEALED = 0.8;
/** A hero dead this long with no revive in sight is presumed lost, and the seat tries to re-hire. */
const DEAD_RETRY = 45;

interface Brain {
  player: number;
  side: Side;
  profile: PlusProfile;
  clock: number;
  thinkIn: number;
  /** The hero it is playing, once it exists. */
  heroId: number;
  /** When the current death was first seen (0 = alive). */
  deadSince: number;
  lastHire: number;
  retreating: boolean;
  orderKey: string;
  orderAt: number;
}

export class DotaAi {
  private readonly brains: Brain[] = [];

  constructor(private readonly host: PlusHost) {}

  get active(): boolean {
    return this.brains.length > 0;
  }

  add(player: number, difficulty: number, seed: number): void {
    const side = sideOf(player);
    if (!side || !HERO_SEATS.has(player) || this.brains.some((b) => b.player === player)) return;
    this.brains.push({
      player, side, profile: plusProfile(difficulty),
      clock: 0, thinkIn: (seed + player) % 5 * 0.1,
      heroId: 0, deadSince: 0, lastHire: -Infinity, retreating: false,
      orderKey: "", orderAt: -Infinity,
    });
  }

  reset(): void {
    this.brains.length = 0;
  }

  tick(dt: number): void {
    for (const b of this.brains) {
      b.clock += dt;
      b.thinkIn -= dt;
      if (b.thinkIn > 0) continue;
      b.thinkIn = Math.max(0.4, b.profile.armyPeriod);
      this.think(b);
    }
  }

  private think(b: Brain): void {
    const hero = this.aliveHero(b);
    if (!hero) {
      if (this.deadHero(b)) {
        const now = b.clock;
        if (!b.deadSince) b.deadSince = now;
        // The map revives its heroes itself; only after a long wait does the seat assume the
        // hero is gone for good and ask the picker again (the map refuses if it is not).
        if (now - b.deadSince < DEAD_RETRY) return;
      }
      this.hire(b);
      return;
    }
    b.heroId = hero.id;
    b.deadSince = 0;

    const home = this.homeOf(b.player);
    const hp = hero.hp / Math.max(1, hero.maxHp);
    if (!b.retreating && hp <= Math.max(0.2, b.profile.retreatHp)) b.retreating = true;
    else if (b.retreating && hp >= HOME_HEALED) b.retreating = false;

    const dest: Pt | null = b.retreating ? home : this.foeBase(b, home);
    if (!dest) return;
    const key = `${b.retreating ? "home" : "push"}:${Math.round(dest.x / 256)},${Math.round(dest.y / 256)}`;
    if (key === b.orderKey && b.clock - b.orderAt < ORDER_REFRESH) return;
    b.orderKey = key;
    b.orderAt = b.clock;
    this.host.execute(b.player, {
      c: "order", unitId: hero.id,
      order: { kind: b.retreating ? "move" : "attackmove", x: dest.x, y: dest.y },
      queued: false,
    });
  }

  /**
   * Buy the seat's hero off a shop the map puts in front of this player.
   *
   * In the map's own Single Draft the shelf is the seat's Circle of Power (`AddUnitToStock` in
   * `XI2`); in the ordinary picker it is the base's hero taverns, whose `Sellunits` the map's
   * ability data supplies. Both are the same `train`, judged for gold, food, side and stock like a
   * person's click, and both end in a hero owned by `player` that the map's `QP1` handler moves to
   * the fountain and records in `K1`. So the AI asks every shop that serves it, cheapest-first in
   * script order, and keeps the first hire the engine accepts.
   */
  private hire(b: Brain): void {
    if (b.clock - b.lastHire < HIRE_RETRY) return;
    const world = this.host.world;
    for (const u of world.units.values()) {
      if (!u.building || u.hp <= 0) continue;
      for (const ware of world.shopWaresOf(u.id).units) {
        if (!this.host.registry.get(ware)?.isHero) continue;
        // No owner/alliance filter here: the map's picker taverns are NEUTRAL, and whether a
        // shop serves this seat is the engine's question (`canUseShop`), answered by `execute`
        // exactly as it is for a person's click.
        b.lastHire = b.clock;
        if (this.host.execute(b.player, { c: "train", buildingId: u.id, unitId: ware })) {
          b.deadSince = 0;
          b.orderKey = "";
          return;
        }
      }
    }
  }

  private aliveHero(b: Brain): SimUnit | null {
    for (const u of this.host.world.units.values()) {
      if (u.owner === b.player && u.isHero && u.hp > 0) return u;
    }
    return null;
  }

  private deadHero(b: Brain): boolean {
    for (const u of this.host.world.units.values()) {
      if (u.owner === b.player && u.isHero && u.hp <= 0) return true;
    }
    return false;
  }

  /** The seat's fountain: its own Circle of Power, which the map puts there. */
  private homeOf(player: number): Pt | null {
    const world = this.host.world;
    for (const u of world.units.values()) {
      if (u.owner === player && u.building && u.hp > 0 && u.typeId === PICKER_TYPE) return { x: u.x, y: u.y };
    }
    for (const u of world.units.values()) {
      if (u.owner === player && u.building && u.hp > 0) return { x: u.x, y: u.y };
    }
    return null;
  }

  /** The other side's base: an enemy Circle of Power, or the mirror of this seat's own. */
  private foeBase(b: Brain, home: Pt | null): Pt | null {
    for (const u of this.host.world.units.values()) {
      if (!u.building || u.hp <= 0 || u.typeId !== PICKER_TYPE) continue;
      if (u.owner === b.player || this.host.coAllied(u.owner, b.player)) continue;
      return { x: u.x, y: u.y };
    }
    return home ? { x: -home.x, y: -home.y } : null;
  }
}
