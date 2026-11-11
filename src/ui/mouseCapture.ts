// MOUSE CAPTURE — the Pointer Lock API, for as long as a match is being played.
//
// A browser window cannot keep the OS pointer inside the page, and WC3's interface needs it
// there: edge scroll asks whether the pointer is in the window at all (`mapViewer`'s
// `pointerInWindow`), so a pointer that walks out over the title bar stops the camera on that
// edge, and on macOS fullscreen the menu bar at the top or a second display takes it the same
// way. Pointer Lock is the one API that confines it: the OS pointer is hidden and parked, and
// the page is handed the raw movement of the physical mouse instead — for as long as the lock
// is held. The browser takes it back on its own the moment Esc is pressed (that key is never
// delivered to the page: it IS the exit gesture), so a release is seen here as a
// `pointerlockchange`, never as a key.
//
// Hiding the OS pointer is only half of a mouse, so the other half is the game's own drawn
// cursor: ui/virtualCursor.ts, the SAME pointer the gamepad drives. That module owns the
// drawing, the hit test and the synthetic events; what is here is the lock's side of it — the
// raw deltas that move the point, the clamping that keeps it on the game frame, and the
// hand-off of every trusted event to the drawn point.
//
// While the lock is held the REAL pointer is parked: `clientX`/`clientY` stay on the pixel the
// lock started at and each event carries its movement instead. Left alone that frozen position
// would fight the drawn one — the camera, the hover, the selection box and the build ghost
// would all sit where the lock began. So every trusted pointer/mouse event is stopped at the
// window (this module's listeners are installed at start-up, before the game adds its own) and
// replayed at the drawn point: a click selects and orders through the same `selectAt`, a held
// left button drags the selection box, a hover raises the tooltip, the wheel zooms, and the
// edge chevron and carried item follow `lastCursor` because that is written by the same events.
//
// What does NOT survive the lock is the browser's own drag-and-drop: an inventory icon can no
// longer be DRAGGED onto the hero bar (`draggable` / `dragstart` is a browser gesture and needs
// a moving OS pointer). Items still move by their click path — right-click the slot, then click
// the destination at the drawn point — which is what WC3 itself asks of a player.

import { anyModalOpen } from "./modal";
import { virtualCursor, type VirtualButton } from "./virtualCursor";

/** What the clamped point has to stay inside. */
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

let installed = false;
/** Is the OS pointer locked into the page right now? */
let captured = false;
/** An exit is in flight: `pointerlockchange` will follow. Blocks an immediate re-lock. */
let stopping = false;
/** The drawn point, in viewport (client) coordinates. */
let px = 0;
let py = 0;
/** The release of each mouse button the lock is holding down, by `MouseEvent.button`. */
const held = new Map<number, () => void>();
/** The release of a button that was still DOWN when the lock was taken away (Esc mid-drag): it
 *  is the end of a press the drawn cursor already finished, not a click on the game, so it must
 *  not take the pointer again. Consumed by the first trusted `pointerup` after the exit. */
let staleUp = false;
/** The game frame, cached: a mousemove must not pay for a layout read. Re-read after a resize. */
let box: Box | null = null;
let boxDirty = true;

/** Is the OS pointer physically confined to the page? */
export function mouseCaptured(): boolean {
  return captured;
}

/**
 * Wire the capture up. Called once at start-up, before a match exists, so that the capture's
 * listeners are in place ahead of the game's — the trusted events have to be stopped before any
 * of the game's window listeners see them.
 */
export function installMouseCapture(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("pointerlockchange", sync);
  document.addEventListener("pointerlockerror", () => { stopping = false; });
  // The frame can change under the lock — a window resize, a resolution change, the letterbox
  // going away — and the point is clamped to it, so the box is read again after one.
  window.addEventListener("resize", () => { boxDirty = true; }, { passive: true });

  // While the lock is held, every trusted event is the lock's own report: swallowed here and
  // replayed at the drawn point. `pointerdown`/`pointerup`/`click`/`contextmenu` come alongside
  // their mouse twins and are swallowed with them — the drawn press already produces both.
  const replay = (type: string, fn?: (e: Event) => void): void => {
    window.addEventListener(
      type,
      (e) => {
        if (!captured || !e.isTrusted) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        fn?.(e);
      },
      { capture: true },
    );
  };
  replay("mousemove", (e) => travel((e as MouseEvent).movementX, (e as MouseEvent).movementY));
  // The boundary events of the PARKED pointer: under the lock it does not enter or leave
  // anything, so a leave the browser sends while the pointer disappears (or a hover it raises
  // where it was parked) would take the hover, and with it a tooltip, off the drawn point.
  for (const type of [
    "pointermove", "pointerdown", "pointerup", "click", "dblclick", "contextmenu",
    "pointerover", "pointerout", "pointerenter", "pointerleave", "mouseover", "mouseout", "mouseenter", "mouseleave",
  ]) replay(type);
  replay("mousedown", (e) => down((e as MouseEvent).button));
  replay("mouseup", (e) => up((e as MouseEvent).button));
  // The wheel keeps its notch, at the drawn point: over the world it zooms, over the HUD it
  // scrolls a list — the same handler either way, as from a mouse.
  replay("wheel", (e) => {
    const w = e as WheelEvent;
    virtualCursor.wheel(w.deltaY, w.deltaX, w.deltaMode);
  });

  // The next click on the game takes the pointer again — after Esc has given it back, or before
  // it has ever been taken. On `pointerup`, not `pointerdown`: the press that starts the lock
  // must finish normally first, or the game never sees its release (a command button would stay
  // lit, a drag box would stay open) because the lock engages before the button comes up.
  window.addEventListener(
    "pointerup",
    (e) => {
      if (!e.isTrusted || captured || stopping) return;
      if (staleUp) {
        staleUp = false;
        return;
      }
      if (!canCapture(e.target)) return;
      startMouseCapture();
    },
    { capture: true },
  );

  // A click is not the only way into the lock, and waiting for one leaves the pointer loose for
  // however long the player only looks around. A key or a wheel notch is the same gesture as far
  // as the browser is concerned, so the first hotkey pressed or zoom scrolled ALSO takes it.
  const alsoTake = (e: Event): void => {
    if (!e.isTrusted || captured || stopping) return;
    if (!canCapture(e.target)) return;
    startMouseCapture();
  };
  window.addEventListener("keydown", alsoTake, { capture: true });
  window.addEventListener("wheel", alsoTake, { capture: true, passive: true });
}

/**
 * Take the pointer, if the game is in a state to want it. A refusal is silent and expected: the
 * request needs a click of its own (see the `pointerup` listener), the browser refuses for a
 * moment after an Esc exit, and the next click simply asks again.
 */
export function startMouseCapture(): void {
  if (captured || stopping || !canCapture(null)) return;
  try {
    // NOT `{ unadjustedMovement: true }`: without it the deltas carry the OS's acceleration
    // curve, which is the feel the player's WC3 mouse has always had — raw deltas would move the
    // drawn cursor by a different amount than the pointer they were used to.
    const p: unknown = document.body.requestPointerLock();
    if (p && typeof (p as Promise<void>).catch === "function") {
      // A refusal is expected and silent: no gesture, or the browser's short cooldown after an
      // Esc exit. The next click asks again.
      (p as Promise<void>).catch(() => { /* refused */ });
    }
  } catch {
    // refused the synchronous way (no user gesture, or not the active tab)
  }
}

/** Give the OS pointer back — the browser's own outcome when Esc is pressed. */
export function stopMouseCapture(): void {
  if (!document.pointerLockElement) {
    // Not locked (a refusal, or already released): nothing to wait for, clean up if needed.
    if (captured) sync();
    return;
  }
  stopping = true;
  document.exitPointerLock();
}

/** The lock came or went. The browser owns both: Esc takes it, a failed request denies it. */
function sync(): void {
  stopping = false;
  const now = document.pointerLockElement !== null;
  if (now === captured) return;
  captured = now;
  if (now) begin();
  else end();
}

function begin(): void {
  const r = frameBox();
  const [x, y] = virtualCursor.point();
  px = clamp(x, r.left, r.right - 1);
  py = clamp(y, r.top, r.bottom - 1);
  // Owned before the cursor is shown: the pad's "the real mouse moved, take the pointer back"
  // must not fire while the lock is the real mouse (see `VirtualCursor.locked`).
  virtualCursor.locked = true;
  virtualCursor.show(px, py); // its move is the one that puts `pointerInWindow` back on
  requestAnimationFrame(watch);
}

function end(): void {
  // A button still down must come up before the pointer is given back: the lock does not deliver
  // its release, and a stuck press would leave a drag box open or the camera riding the army.
  const releases = [...held.values()];
  held.clear();
  staleUp = releases.length > 0;
  for (const release of releases) release();
  virtualCursor.locked = false;
  virtualCursor.hide();
  stopping = false;
}

/**
 * The state the lock is allowed in, asked every frame while it is held and before it is taken:
 * a live match, no menu, no modal, no dialog, the dev drawer away, and nobody typing in a text
 * field. Anything else gives the pointer back — the menus, the Options panels and the chat line
 * need the OS pointer to point and click like a page.
 */
function canCapture(target: EventTarget | null): boolean {
  const body = document.body.classList;
  if (!body.contains("in-game")) return false;
  if (body.contains("game-menu-open") || body.contains("game-paused")) return false;
  if (anyModalOpen()) return false;
  if (document.querySelector(".dev-tools:not([hidden]) .dev-drawer:not([hidden])")) return false;
  const field = target instanceof Element ? target.closest("input, textarea, [contenteditable='true']") : null;
  if (field) return false;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest("input, textarea, [contenteditable='true']")) return false;
  return true;
}

/** Re-checked every frame while the lock is held: the panel that takes it away may come from
 *  anywhere (the F10 menu, a script's dialog, a slide into the score screen), and the drawn
 *  cursor's art is redrawn with the world under it. */
function watch(): void {
  if (!captured) return;
  if (!canCapture(null)) {
    stopMouseCapture();
    return;
  }
  virtualCursor.repaint();
  requestAnimationFrame(watch);
}

/** Accumulate the lock's raw movement into the point, clamped to the game frame. Clamped and not
 *  wrapped: parked ON an edge is exactly what edge scroll is asking for, on all four of them. */
function travel(dx: number, dy: number): void {
  if (!captured) return;
  const r = frameBox();
  px = clamp(px + dx, r.left, r.right - 1);
  py = clamp(py + dy, r.top, r.bottom - 1);
  virtualCursor.move(px, py);
}

function down(button: number): void {
  if (button !== 0 && button !== 1 && button !== 2) return;
  // The same button twice (a lost release) is finished first, as a fresh press would be.
  held.get(button)?.();
  held.delete(button);
  const release = virtualCursor.press(button as VirtualButton);
  if (release) held.set(button, release);
}

function up(button: number): void {
  const release = held.get(button);
  held.delete(button);
  release?.();
}

/**
 * The frame the point is clamped to: the canvas the world is drawn on, letterboxed into the
 * page — NOT the window. Edge scroll asks the frame's own four edges, and the black bar round it
 * counts as past them (`updateEdgeScroll`), so clamping to the window would park the point in the
 * bar with the drawn cursor out over nothing.
 */
function frameBox(): Box {
  if (!boxDirty && box) return box;
  boxDirty = false;
  const el = document.getElementById("world-layer") ?? document.getElementById("map");
  const r = el?.getBoundingClientRect();
  box = r && r.width > 2 && r.height > 2
    ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  return box;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}
