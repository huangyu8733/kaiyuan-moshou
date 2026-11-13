// Discrete on-screen performance metrics plus a sound mute toggle — the bottom corner strip.
//
// HIDDEN BY DEFAULT (issue: "turn off the bottom-left debug info") — it sits over the corner
// where a player reads nothing the game needs. F4 toggles it (render/mapViewer.ts keydown);
// `toggle()` reports the new state.
//
// Two dresses, decided once at build time:
//
//   · A DEV build (`pnpm dev`) prints the whole developer's readout — fps, frame time, the
//     sim's unit census, the ping — and carries the mute button, because the person reading it
//     is debugging.
//   · A PRODUCTION build — what the desktop app packages and what a release serves — prints
//     what a PLAYER reads: the fps, and in a multiplayer match the ping. Nothing else, and no
//     mute button (the Sound panel owns volume). Single player shows the fps alone: there is
//     no wire to measure, so a ping label there would only ever say "—".
//
// The ping is the slowest link this machine is on (game/matchLink.ts PingMessage): `undefined`
// means "no match link" (single player), `null` "linked, no echo home yet".

import { setGameTip } from "./gameTip";

const UPDATE_PERIOD = 500; // ms between DOM updates (readable, not flickery)

/** The full readout is the developer's; a shipped build shows the player's two numbers. */
const DEV_READOUT = import.meta.env.DEV;

export class MetricsOverlay {
  private el: HTMLDivElement;
  private text: HTMLSpanElement;
  private muteBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private muted = false;
  private visible = false; // off until F4 — the corner is the player's, not the debugger's
  private frames = 0;
  private accMs = 0;

  /** Toggled when the mute button is clicked (new muted state). Host wires audio. */
  onToggleMute: ((muted: boolean) => void) | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "metrics";
    this.el.hidden = true;
    this.text = document.createElement("span");
    this.muteBtn = document.createElement("button");
    this.muteBtn.className = "metrics-mute";
    this.muteBtn.textContent = "🔊";
    setGameTip(this.muteBtn, "Mute all sound");
    this.muteBtn.onclick = () => {
      this.muted = !this.muted;
      this.muteBtn.textContent = this.muted ? "🔇" : "🔊";
      setGameTip(this.muteBtn, this.muted ? "Unmute sound" : "Mute all sound");
      this.onToggleMute?.(this.muted);
    };
    this.muteBtn.hidden = !DEV_READOUT; // a player's strip carries no debug control
    // The collapse button is the strip's own door out — visible whenever the strip is, so
    // dismissing it never needs the keyboard (F4 stays as the shortcut).
    this.closeBtn = document.createElement("button");
    this.closeBtn.className = "metrics-mute metrics-close";
    this.closeBtn.textContent = "✕";
    setGameTip(this.closeBtn, "收起调试信息 (F4)");
    this.closeBtn.onclick = () => this.toggle();
    this.el.append(this.text, this.muteBtn, this.closeBtn);
    document.body.appendChild(this.el);
  }

  /** F4 — show or hide the strip. Returns the new visibility. The CSS hides the strip by
   *  default (`.metrics` has no display) and only `.metrics-live` shows it: the class, not
   *  the `hidden` attribute, is what a stale cached script cannot undo. The attribute is
   *  kept in sync for the gamepad toast stack, which measures the strip by it. */
  toggle(): boolean {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
    this.el.classList.toggle("metrics-live", this.visible);
    return this.visible;
  }

  /** Call once per rendered frame with the frame delta in ms. `ping` as `RtsController.pingMs`
   *  answers it: a number, null (linked, nothing measured yet) or undefined (single player).
   *  Counts every frame regardless, so a freshly toggled-on strip reads true at once; it
   *  writes the DOM only while visible. */
  frame(dtMs: number, units: number, ping: number | null | undefined): void {
    this.frames++;
    this.accMs += dtMs;
    if (!this.visible || this.accMs < UPDATE_PERIOD) return;
    const avg = this.accMs / this.frames;
    const fps = `${Math.round(1000 / avg)} fps`;
    const pingText = ping === undefined ? "" : ` · ping ${ping === null ? "—" : `${Math.round(ping)} ms`}`;
    this.text.textContent = DEV_READOUT ? `${fps} · ${avg.toFixed(1)} ms · ${units} units${pingText}` : `${fps}${pingText}`;
    this.frames = 0;
    this.accMs = 0;
  }

  hide(): void {
    this.el.hidden = true;
    this.el.classList.remove("metrics-live");
    this.visible = false;
  }

  dispose(): void {
    this.el.remove();
  }
}
