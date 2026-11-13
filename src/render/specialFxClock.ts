// Where a script `effect` is in its life (7.26 — issue #68).
//
// An effect runs on the GAME's clock, and this is the rule that says so. It is pure and
// lives apart from the renderer so the headless suite can drive it (tools/jass-corpus-test.cjs
// §7.26b) — the renderer only has to obey what it returns.
//
// Why it exists at all: an mdx instance advances its own `frame` ONLY on the frames the
// scene draws it (`ModelInstance.update` is gated on `rendered && isVisible(camera)`), so
// an effect the player isn't looking at freezes where it stands. Left to that clock, an
// effect created in the fog of war sat at frame 0 for as long as the player looked
// elsewhere and then played its Birth from the start, minutes late — the art queued up
// instead of happening. So the effect's AGE decides its phase, not the instance's frame.
//
// A WC3 effect model is a three-act clip — Birth, Stand, Death (verified on
// DivineShieldTarget/FrostArmorTarget and friends) — but most spawn flourishes ship only
// the Birth: AnimateDeadTarget.mdx, the one issue #68 reports, has exactly one sequence,
// `Birth [0, 2333]`. That difference is the whole of the rule below.

/** The clips a given effect model actually has. Read once, when the model loads. */
export interface SpecialFxClips {
  /** Does the model have a Birth clip at all? */
  hasBirth: boolean;
  /** The Birth clip's first model frame, and how many seconds it runs. */
  birthStart: number;
  birthSecs: number;
  /** Does it have a Stand to settle into — i.e. is it a PERSISTENT effect? */
  hasStand: boolean;
  /** How long the ONE clip a Birth-less model plays (`ThunderclapCaster`, `WarStompCaster`,
   *  and the imported `…Death.mdx` bursts) runs. A persistent effect loops it for as long as
   *  the script keeps it; a DOOMED one gets exactly one pass. 0 when the model has no sane
   *  clip at all. */
  standSecs: number;
}

export type SpecialFxPhase =
  /** Playing its Birth. `frame` is the model frame the instance must sit on right now —
   *  driving it from age is what makes a frozen effect resume mid-flight rather than
   *  restart when the player finally looks at it. */
  | { kind: "birth"; frame: number }
  /** The steady state: looping its Stand until the script's DestroyEffect. A persistent
   *  effect the player only now lays eyes on is ALREADY here — WarChasers' Sun Key swirl
   *  is on the key when you arrive, it does not spawn itself at you. */
  | { kind: "stand" }
  /** Birth-only art whose clip has run out. Its whole life WAS that clip, so it is over —
   *  whether or not anyone saw it — and it is never drawn again. This is what keeps an
   *  effect that played out in the fog from turning up late. */
  | { kind: "spent" };

/**
 * Does DestroyEffect owe this effect the clip the game still shows?
 *
 * `call DestroyEffect(AddSpecialEffect(…))` destroys an effect in the very frame it was made,
 * and WC3 plays it out anyway — that one-shot idiom is the whole of DotA's spell-art layer (a
 * Fissure is twenty-five VolcanoDeath models written exactly that way). So an effect whose Birth
 * still has time on it is NOT taken off the scene: it runs the clip and leaves at the end of it
 * (the `doomed` release in updateSpecialFx). Once the Birth is done there is nothing owed — a
 * persistent effect goes through its Death clip, a Birth-only one has already been spent.
 *
 * `scriptOwnsClip` is BlzPlaySpecialEffect: from then on the script picked the animation, and
 * the Birth → Stand lifecycle — this rule included — no longer speaks for it.
 *
 * A model with NO Birth (ThunderclapCaster, WarStompCaster, the imported `…Death.mdx` bursts —
 * 52 of DotA's 236 script effects) is owed ONE PASS of the single clip it has: those are
 * one-shot bursts too, and dropping them on the DestroyEffect line drew nothing.
 */
export function specialFxOwesItsClip(age: number, clips: SpecialFxClips, scriptOwnsClip: boolean): boolean {
  if (scriptOwnsClip) return false;
  if (clips.hasBirth) return age < clips.birthSecs;
  return clips.standSecs > 0 && age < clips.standSecs;
}

/** Is a DOOMED effect (see specialFxOwesItsClip) done — has the life it was owed run out? A
 *  Birth-full model leaves when its Birth does, a Birth-less one after its one pass. */
export function specialFxDoomedOver(age: number, clips: SpecialFxClips): boolean {
  return age >= (clips.hasBirth ? clips.birthSecs : clips.standSecs);
}

/** The effect's phase at `age` seconds old. Total: age alone decides it. */
export function specialFxPhaseAt(age: number, clips: SpecialFxClips): SpecialFxPhase {
  // No Birth clip: there is no flourish to play out and nothing to age past. The effect is
  // simply here, looping whatever single clip it has, for as long as the script keeps it.
  if (!clips.hasBirth) return { kind: "stand" };
  if (age < clips.birthSecs) return { kind: "birth", frame: clips.birthStart + age * 1000 };
  return clips.hasStand ? { kind: "stand" } : { kind: "spent" };
}
