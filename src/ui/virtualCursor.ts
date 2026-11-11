// The DRAWN POINTER — one virtual mouse for the inputs that have to place the pointer themselves.
//
// A page cannot move the OS pointer, so anything that drives a pointer without a physical one
// draws its own: the gamepad's left stick (ui/gamepad.ts) and the mouse while the Pointer Lock
// API has it (ui/mouseCapture.ts, which the OS pointer cannot leave and whose clientX/Y are
// frozen). Both drive THIS cursor, because there is only ever one pointer in the game:
//
//   · `el` (`.gamepad-cursor`, style.css) is the drawn image, positioned fixed at the point and
//     offset by the hotspot of the `cursor:` it wears.
//   · `veil` (`#gamepad-veil`) is a transparent layer over the whole page wearing
//     `cursor: none` — which is how the OS pointer is hidden, since a page cannot move it out of
//     the way. It is a LAYER rather than a `cursor: none` rule on everything because the drawn
//     cursor is read OFF the page's own `cursor:` values (`repaint`): a global rule would make
//     every element answer "none" and the drawn cursor would vanish with the OS one. The layer
//     is hit-tested PAST (`hitAt`), so events still reach what is under it.
//   · the ART is whatever the element under the point asks for — read off the computed style, so
//     every cursor rule the game already has (the race gauntlet, the armed reticle, the tinted
//     hover hand, the edge-pan chevron) applies without being restated, hotspot included. The
//     FIRST image of the list is the one a mouse would wear away from an edge; the ≤32 px twins
//     behind it exist only for the OS's sake (ui/cursor.ts `cursorValue`).
//   · the EVENTS are real DOM pointer/mouse events dispatched at that element, with the boundary
//     events (`pointerover`/`enter`/`leave`/`out`) a moving mouse would have produced, plus the
//     click on release, the right button's `contextmenu`, and the wheel. So a click on the world
//     selects through `selectAt`, a click on a glue button fires its handler, a held button drags
//     the selection box, and a tooltip follows — all of it the same code that answers a mouse.

/** Which button a virtual press is, in the `MouseEvent.button` numbering. */
export type VirtualButton = 0 | 1 | 2;

/** How often the `cursor:` under the point is re-read. The value is a long data URL, so it is
 *  not asked every frame. */
const STYLE_MS = 100;

export class VirtualCursor {
  private el: HTMLDivElement | null = null;
  private img: HTMLImageElement | null = null;
  private veil: HTMLDivElement | null = null;
  /** The element the cursor is over, and the chain `.pad-hover` is on. */
  private hoverEl: Element | null = null;
  /** The element a held button went down on — the implicit capture a real press has. */
  private captureEl: Element | null = null;
  /** Which buttons are held, as a `MouseEvent.buttons` mask. */
  private heldMask = 0;
  private styleAt = 0;
  private value = "";
  /** Where the real mouse last was, so the cursor starts where the player was looking. */
  private realX = -1;
  private realY = -1;
  private shown = false;
  private px = 0;
  private py = 0;
  /** Ownership: while set, a real pointer moving must NOT take the cursor away. The mouse
   *  capture sets this for as long as the pointer is locked — every `mousemove` it sees is the
   *  lock's own movement report, not a mouse that has come back. */
  locked = false;
  private guarded = false;

  /** Is the cursor up (a device is driving the pointer)? */
  get isShown(): boolean {
    return this.shown;
  }
  get x(): number {
    return this.px;
  }
  get y(): number {
    return this.py;
  }

  /** The real mouse, as a live position and as the thing that takes the pointer back. Only
   *  trusted events should be passed here — the pad's own synthetic ones pass through these
   *  window listeners too. */
  noteReal(e: { clientX: number; clientY: number; movementX?: number; movementY?: number }): void {
    this.realX = e.clientX;
    this.realY = e.clientY;
    if (this.shown && !this.locked && (e.movementX || e.movementY)) this.hide();
  }

  /** A real press or wheel notch is the mouse too: it takes the pointer back. (It lands on the
   *  veil while a device has the pointer, so that one press is spent doing it — a player picking
   *  the mouse up moves it first anyway.) */
  releaseToReal(): void {
    if (this.shown && !this.locked) this.hide();
  }

  /** Where the cursor is — or, before it has ever moved, where the mouse was. */
  point(): [number, number] {
    if (this.shown) return [this.px, this.py];
    return this.realX >= 0 ? [this.realX, this.realY] : [window.innerWidth / 2, window.innerHeight / 2];
  }

  /** Put the cursor up at (x, y) — at `point()` when no start is given — and take the pointer. */
  show(x?: number, y?: number): void {
    this.guard();
    const at: [number, number] = x === undefined || y === undefined ? this.point() : [x, y];
    this.shown = true;
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.className = "gamepad-cursor";
      this.img = document.createElement("img");
      this.img.alt = "";
      this.el.appendChild(this.img);
      this.veil = document.createElement("div");
      this.veil.id = "gamepad-veil";
      document.body.append(this.veil, this.el);
    }
    this.el.hidden = false;
    if (this.veil) this.veil.hidden = false;
    this.move(at[0], at[1]);
  }

  hide(): void {
    if (!this.shown) return;
    // The lock owns the pointer: the pad standing down (an unpair, a Voice click on a button
    // that takes its screen away) must not take the mouse's cursor out from under it.
    if (this.locked) return;
    this.shown = false;
    this.heldMask = 0;
    this.captureEl = null;
    if (this.el) this.el.hidden = true;
    if (this.veil) this.veil.hidden = true;
    this.setHover(null);
  }

  /** Put the ART away but keep the pointer owned — the pad's menu box is the pointer then. */
  setArtVisible(visible: boolean): void {
    if (this.el) this.el.hidden = !visible;
    if (visible) this.styleAt = 0; // what was read while hidden may no longer be the right art
  }

  /** Put the POINT at (x, y) without sending the move a mouse would: the pad's box has the
   *  pointer on a menu, where the events go to the control's centre (`hoverAt`) and the cursor
   *  comes back to the box when the stick takes the pointer again (issue #162). */
  place(x: number, y: number): void {
    this.px = Math.min(Math.max(x, 0), window.innerWidth - 1);
    this.py = Math.min(Math.max(y, 0), window.innerHeight - 1);
    this.repaint();
  }

  /** Move the point (clamped to the viewport) and send it the move a mouse would have sent. */
  move(x: number, y: number): void {
    this.px = Math.min(Math.max(x, 0), window.innerWidth - 1);
    this.py = Math.min(Math.max(y, 0), window.innerHeight - 1);
    const under = this.hitAt(this.px, this.py);
    this.setHover(under);
    const target = this.captureEl ?? under;
    if (target) {
      target.dispatchEvent(this.pointerEvent("pointermove", -1));
      target.dispatchEvent(this.mouseEvent("mousemove", 0));
    }
    this.repaint();
  }

  /** Re-read the cursor the element under the point asks for and draw it there. Throttled: a
   *  world that moves under a still pointer changes only what it should look like, not often. */
  repaint(): void {
    if (!this.el || !this.img) return;
    this.el.style.transform = `translate(${Math.round(this.px)}px, ${Math.round(this.py)}px)`;
    const now = performance.now();
    if (now - this.styleAt < STYLE_MS) return;
    // The page can take the element out from under a STILL cursor — X on an Options category
    // rebuilds that panel's whole tree — and a detached element's `cursor` reads "" (drawn as
    // the plain fallback arrow, over a panel that asks for the gauntlet). A real mouse is
    // re-targeted by the browser after such a change; this one is re-targeted here, boundary
    // events and all.
    if (this.hoverEl && !this.hoverEl.isConnected) this.setHover(this.hitAt(this.px, this.py));
    this.styleAt = now;
    const value = this.hoverEl ? getComputedStyle(this.hoverEl).cursor : getComputedStyle(document.body).cursor;
    if (value === this.value) return;
    this.value = value;
    const m = /url\("?([^")]+)"?\)\s*(-?\d+)?\s*(-?\d+)?/.exec(value);
    if (value === "none" || !m) {
      this.img.hidden = value === "none";
      if (!m) {
        this.img.removeAttribute("src");
        this.el.classList.toggle("plain", value !== "none");
      }
      return;
    }
    this.el.classList.remove("plain");
    this.img.hidden = false;
    this.img.src = m[1];
    this.img.style.left = `${-(Number(m[2]) || 0)}px`;
    this.img.style.top = `${-(Number(m[3]) || 0)}px`;
  }

  /** Is `el` under the pointer — the real one (`:hover`) or the drawn one? The places that ASK
   *  the DOM whether a slot is still hovered (rather than trusting the events) ask this instead,
   *  or a tooltip raised by the drawn pointer is taken down the next frame for not being
   *  `:hover`. */
  hovered(el: Element): boolean {
    if (el.matches(":hover")) return true;
    return this.shown && !!this.hoverEl && el.contains(this.hoverEl);
  }

  /** Point at (x, y) without moving the drawn cursor — the pad's menu box does this when it
   *  lands on a control: the events have to go to the control's centre. */
  hoverAt(x: number, y: number): void {
    this.setHover(this.hitAt(x, y));
  }

  /** The element at a point as the page would see it with no veil over it. */
  hitAt(x: number, y: number): Element | null {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el !== this.veil && el !== this.el && !this.el?.contains(el)) return el;
    }
    return null;
  }

  /**
   * Hold button `b` down at the point, and return the release that finishes it (or null when
   * there is nothing under the point). The release sends the up, and the click on the nearest
   * element both ends share — as a real press and release do — or the right button's
   * `contextmenu`; a middle-button drag has neither.
   */
  press(b: VirtualButton): (() => void) | null {
    if (!this.shown) this.show();
    const bit = b === 0 ? 1 : b === 1 ? 4 : 2;
    const under = this.hitAt(this.px, this.py);
    if (!under) return null;
    this.setHover(under);
    this.heldMask |= bit;
    if (b !== 2) this.captureEl = under; // a left/middle DRAG keeps its moves, as a real press does
    const downOk = under.dispatchEvent(this.pointerEvent("pointerdown", b));
    const mouseOk = under.dispatchEvent(this.mouseEvent("mousedown", b));
    // A real press focuses what it lands on (an edit box, the chat line); a synthetic one does
    // not, unless we do it. Skipped when a handler said no, as the browser would.
    if (downOk && mouseOk && b === 0) {
      const field = under.closest<HTMLElement>("input, textarea, select, [tabindex], [contenteditable='true']");
      if (field) field.focus();
      else if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur();
    }
    return () => {
      this.heldMask &= ~bit;
      const upAt = (b !== 2 ? this.captureEl : null) ?? this.hitAt(this.px, this.py) ?? under;
      if (b !== 2) this.captureEl = null;
      upAt.dispatchEvent(this.pointerEvent("pointerup", b));
      upAt.dispatchEvent(this.mouseEvent("mouseup", b));
      if (b === 1) return;
      // The click lands on the nearest element both ends of it share, as it does for a mouse.
      const end = this.hitAt(this.px, this.py);
      let common: Element | null = end;
      while (common && !common.contains(under)) common = common.parentElement;
      if (!common) return;
      common.dispatchEvent(this.mouseEvent(b === 0 ? "click" : "contextmenu", b, null, true, b === 2));
    };
  }

  /** One wheel notch at the point, on whatever is under it — the canvas zooms, a list scrolls. */
  wheel(deltaY: number, deltaX = 0, deltaMode = 0): void {
    const target = this.captureEl ?? this.hitAt(this.px, this.py);
    if (!target) return;
    target.dispatchEvent(new WheelEvent("wheel", {
      ...this.init(-1, null, true),
      deltaY,
      deltaX,
      deltaMode,
    }));
  }

  /**
   * Move the hover to `next`, firing the boundary events a real pointer would have, and keep
   * `.pad-hover` on its ancestor chain — the stylesheet's stand-in for `:hover`.
   */
  private setHover(next: Element | null): void {
    const prev = this.hoverEl;
    if (prev === next) return;
    this.hoverEl = next;
    const chain = (el: Element | null): Element[] => {
      const out: Element[] = [];
      for (let e = el; e; e = e.parentElement) out.push(e);
      return out;
    };
    const oldChain = chain(prev);
    const newChain = chain(next);
    if (prev) {
      prev.dispatchEvent(this.pointerEvent("pointerout", -1, next));
      prev.dispatchEvent(this.mouseEvent("mouseout", 0, next));
      for (const el of oldChain) {
        if (newChain.includes(el)) break;
        el.classList.remove("pad-hover");
        el.dispatchEvent(this.pointerEvent("pointerleave", -1, next, false));
        el.dispatchEvent(this.mouseEvent("mouseleave", 0, next, false));
      }
    }
    if (next) {
      next.dispatchEvent(this.pointerEvent("pointerover", -1, prev));
      next.dispatchEvent(this.mouseEvent("mouseover", 0, prev));
      for (const el of [...newChain].reverse()) {
        if (oldChain.includes(el)) continue;
        el.classList.add("pad-hover");
        el.dispatchEvent(this.pointerEvent("pointerenter", -1, prev, false));
        el.dispatchEvent(this.mouseEvent("mouseenter", 0, prev, false));
      }
    }
    this.styleAt = 0; // a new element may want a new cursor
  }

  /**
   * The veil going up under a STILL mouse is a layout change under the pointer, and the browser
   * answers it with real boundary events: the element the OS pointer was over is told it has
   * been left, for the veil. The drawn cursor starts exactly where the mouse was, so that
   * element is usually the one just ENTERED — and a command button's tooltip, raised by the
   * cursor's own pointerenter, was taken straight back down by the real pointerleave. While a
   * device has the pointer those events describe nothing the player did, so they are stopped at
   * the window, before any handler sees them. (Capture runs for the non-bubbling enter/leave
   * too.) The ones the veil's REMOVAL sends are left alone: by then the mouse is moving and they
   * are true.
   *
   * Installed on the first `show()`, BEFORE the veil is appended — the browser fires those
   * boundary events after the layout change, so a listener added in the same task still catches
   * them. Nothing is swallowed while no device has the pointer (`shown` is false then).
   */
  private guard(): void {
    if (this.guarded || typeof window === "undefined") return;
    this.guarded = true;
    for (const type of ["pointerover", "pointerout", "pointerenter", "pointerleave", "mouseover", "mouseout", "mouseenter", "mouseleave"] as const) {
      window.addEventListener(
        type,
        (e) => {
          if (e.isTrusted && this.shown && (e.target === this.veil || e.relatedTarget === this.veil)) e.stopImmediatePropagation();
        },
        { capture: true },
      );
    }
  }

  private pointerEvent(type: string, button: number, related: Element | null = null, bubbles = true): PointerEvent {
    return new PointerEvent(type, {
      ...this.init(button, related, bubbles),
      // The mouse's own id: Chromium treats pointer 1 as always active, so a handler's
      // `setPointerCapture(e.pointerId)` accepts it instead of throwing on an unknown pointer.
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    });
  }

  private mouseEvent(type: string, button: number, related: Element | null = null, bubbles = true, cancelable = true): MouseEvent {
    return new MouseEvent(type, { ...this.init(button, related, bubbles), cancelable });
  }

  private init(button: number, related: Element | null, bubbles: boolean): MouseEventInit {
    return {
      bubbles,
      cancelable: true,
      composed: true,
      clientX: this.px,
      clientY: this.py,
      screenX: this.px,
      screenY: this.py,
      button: Math.max(button, 0),
      buttons: this.heldMask,
      relatedTarget: related,
      view: window,
    };
  }
}

/** The one pointer in the game. ui/gamepad.ts and ui/mouseCapture.ts both drive it. */
export const virtualCursor = new VirtualCursor();
