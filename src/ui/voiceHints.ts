// Voice Control's hint box: a short list of things worth SAYING, on the right of the screen in a
// match, while Voice Control is on. Ours — the game has no voice commands to remind anyone of.
//
// It starts COLLAPSED: one line ("语音命令 · 展开") that takes almost nothing from the map. A
// click on that line — or "," — opens it; a second click closes it. Open, the list scrolls, so
// every group stays readable on a short screen instead of running off the bottom. The open/closed
// state is remembered for this browser. It takes no clicks while closed beyond its own header.

/** The key that opens and closes the box. */
export const VOICE_HINTS_KEY_CODE = "Comma";

import { currentLocale, t } from "../i18n";

const STORE_KEY = "ow3.voiceHints.expanded";

/** The examples, worded with this race's own names. */
export interface HintNames {
  worker: string;
  soldier: string;
  farm: string;
}

/** What kind of match the box is over: a campaign chapter, a melee map, or a custom map. The
 *  campaign's words are not shown over a skirmish, and a map's own words only over that map. */
export interface HintContext {
  kind: "campaign" | "melee" | "custom";
  /** A custom map's own sentences (its `<map>.voice.json` `say` lines), in this language. */
  mapLines?: readonly string[];
}

const plural = (name: string): string => {
  const w = name.toLowerCase();
  if (w.endsWith("man")) return `${w.slice(0, -3)}men`;
  if (/(s|x|ch|sh)$/.test(w)) return `${w}es`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
};

/** The commands, in groups — the developer's priority first: selecting the army and a worker.
 *  The campaign's group is only for a campaign chapter, the skirmish's only for a melee map, and
 *  a map's own sentences only for that custom map. */
function groups(n: HintNames, ctx: HintContext): Array<{ title: string; lines: string[] }> {
  const out: Array<{ title: string; lines: string[] }> = [];
  if (currentLocale() === "zhCN") {
    out.push(
      { title: t("voice.hints.select"), lines: ["选中所有部队", `选中${n.worker}`, "选中英雄", `选中${n.soldier} 2`, "第二队", "全选屏幕"] },
      { title: t("voice.hints.move"), lines: ["向上移动", "向左移动一点", "移动到鼠标", "移动到这里", "排队移动到这里", "标记这里", "撤退", "停止"] },
      { title: t("voice.hints.attack"), lines: ["攻击敌人", "攻击敌人英雄", "攻击红色营地", "攻击移动到这里", "巡逻", "跟随英雄"] },
      { title: t("voice.hints.skills"), lines: ["使用风暴之锤", "风暴之锤敌人英雄", "对敌人英雄使用风暴之锤", "对英雄使用圣光", "学习风暴之锤", "研究步兵攻防", "使用治疗药膏", "对英雄使用治疗药膏", "使用物品一", "丢弃治疗药膏", "买治疗药膏", "卖物品一", "自动施放圣光", "关闭自动施放圣光", "把治疗药膏给英雄"] },
      { title: t("voice.hints.groups"), lines: ["编为第二队", "取消第二队", "取消编组", "保持位置", "攻击地面", "集结点", "复活英雄", "修理", "自动修理", "关闭自动修理", "移出编队", "共享视野", "共享控制", "结盟", "下一组", "集火敌人英雄", "交换物品一和三"] },
      { title: t("voice.hints.build"), lines: [`训练三个${n.soldier}`, `建造${n.farm}在这里`, `完成${n.farm}`, "取消建造", "取消训练步兵", "清空队列", "建造菜单", "采集金矿", "去伐木", "拾取地上的物品", "装载", "卸载"] },
      { title: t("voice.hints.camera"), lines: ["镜头到中间", "镜头到红色营地"] },
      { title: t("voice.hints.chat"), lines: ["说打得不错", "对所有人说 gg"] },
    );
    if (ctx.kind === "campaign") {
      out.push({ title: t("voice.hints.campaign"), lines: ["跳过过场", "继续游戏", "任务列表", "下一个任务", "任务进度", "第四个选项", "拒绝", "继续", "找到英雄", "和英雄说话", "集合部队", "保护英雄", "搜刮物品", "去治疗", "把治疗药膏给英雄"] });
    } else if (ctx.kind === "melee") {
      out.push({ title: t("voice.hints.battle"), lines: ["侦察", "集火", "推进", "防守"] });
    }
  } else {
    const worker = n.worker.toLowerCase();
    const soldier = n.soldier.toLowerCase();
    out.push(
      { title: t("voice.hints.select"), lines: ["select army", `select ${worker}`, "select hero", `select ${soldier} 2`, "group 2", "select all on screen"] },
      { title: t("voice.hints.move"), lines: ["move up", "move left a bit", "move to the cursor", "move here", "queue move here", "signal here", "fall back", "stop"] },
      { title: t("voice.hints.attack"), lines: ["attack the enemy", "attack the enemy hero", "attack the red camp", "attack move here", "patrol", "follow the hero"] },
      { title: t("voice.hints.skills"), lines: ["use storm bolt", "storm bolt the enemy hero", "cast storm bolt on the enemy hero", "holy light the hero", "learn storm bolt", "research footman armor", "use healing salve", "use healing salve on the hero", "use item 1", "drop the healing salve", "buy a healing salve", "sell item 1", "autocast holy light", "turn off holy light", "give the salve to the hero"] },
      { title: t("voice.hints.groups"), lines: ["make group 2", "cancel group 2", "ungroup", "hold position", "attack ground", "set rally point", "revive the hero", "repair the tower", "auto repair", "auto repair off", "remove the footman from group 2", "share vision", "share control", "allies", "next subgroup", "focus the enemy hero", "swap item 1 and 3"] },
      { title: t("voice.hints.build"), lines: [`train three ${plural(soldier)}`, `build a ${n.farm.toLowerCase()} here`, `finish the ${n.farm.toLowerCase()}`, "cancel", "cancel the footman", "clear queue", "build menu", "gather gold", "gather lumber", "pick up the item", "load the transport", "unload"] },
      { title: t("voice.hints.camera"), lines: ["camera to the middle", "camera to a red camp"] },
      { title: t("voice.hints.chat"), lines: ["say gg", "say gg to all"] },
    );
    if (ctx.kind === "campaign") {
      out.push({ title: t("voice.hints.campaign"), lines: ["skip the cinematic", "continue game", "quest list", "next quest", "quest progress", "fourth option", "decline", "continue", "find the hero", "talk to the hero", "regroup", "protect the hero", "loot the area", "go heal", "give the salve to the hero"] });
    } else if (ctx.kind === "melee") {
      out.push({ title: t("voice.hints.battle"), lines: ["scout", "focus fire", "push", "defend"] });
    }
  }
  // A custom map's own sentences, only on that map. No file, no group.
  if (ctx.kind === "custom" && ctx.mapLines?.length) {
    out.push({ title: t("voice.hints.map"), lines: [...ctx.mapLines].slice(0, 16) });
  }
  return out;
}

export interface VoiceHints {
  setEnabled(on: boolean): void;
  dispose(): void;
}

export function mountVoiceHints(ui: HTMLElement, names: () => HintNames, context?: () => HintContext): VoiceHints {
  const box = document.createElement("div");
  box.className = "voice-hints";
  box.hidden = true;

  // The always-there one line: a button, so a click opens the list ("," does the same) and the
  // map underneath keeps its clicks while the list is shut.
  const head = document.createElement("button");
  head.type = "button";
  head.className = "voice-hints-head";
  head.innerHTML = `<span class="voice-hints-heading"><span class="voice-hints-title-text">${t("voice.hints.title")}</span><span class="voice-hints-key">${t("voice.hints.hold")}</span></span><span class="voice-hints-state"></span>`;
  const state = head.querySelector(".voice-hints-state") as HTMLElement;

  // The list itself: scrolls, so every group is reachable on any screen height.
  const body = document.createElement("div");
  body.className = "voice-hints-body";
  // The pager: a wheel over the list scrolls it (the match replays the wheel as a synthetic
  // event, which does NOT perform the browser's own scrolling — see the listener below), and
  // these two buttons are the same page-turn for a player who never touches the wheel.
  const foot = document.createElement("div");
  foot.className = "voice-hints-foot";
  foot.innerHTML = `<span class="voice-hints-page-box"><button type="button" class="voice-hints-page" data-dir="-1">${t("voice.hints.pageup")}</button><button type="button" class="voice-hints-page" data-dir="1">${t("voice.hints.pagedown")}</button></span><span class="voice-hints-toggle-hint">${t("voice.hints.toggle")}</span>`;
  const pager = foot.querySelector(".voice-hints-page-box") as HTMLElement;
  box.append(head, body, foot);
  ui.appendChild(box);

  let enabled = false;
  let expanded = false;
  try {
    expanded = localStorage.getItem(STORE_KEY) === "1";
  } catch {
    /* no storage: starts collapsed */
  }
  let worded = "";

  const render = (): void => {
    const n = names();
    const ctx = context?.() ?? { kind: "custom" as const };
    const sig = `${n.worker}|${n.soldier}|${n.farm}|${ctx.kind}|${(ctx.mapLines ?? []).join("\u0001")}`;
    if (sig === worded) return;
    worded = sig;
    body.replaceChildren();
    for (const g of groups(n, ctx)) {
      const title = document.createElement("div");
      title.className = "voice-hints-title";
      title.textContent = g.title;
      const list = document.createElement("ul");
      list.className = "voice-hints-list";
      for (const line of g.lines) {
        const li = document.createElement("li");
        li.textContent = line;
        list.appendChild(li);
      }
      body.append(title, list);
    }
  };

  const syncPager = (): void => {
    if (body.hidden) return;
    pager.hidden = body.scrollHeight <= body.clientHeight + 2;
  };

  const sync = (): void => {
    box.hidden = !enabled;
    body.hidden = !expanded;
    foot.hidden = !expanded;
    head.setAttribute("aria-expanded", String(expanded));
    state.textContent = t(expanded ? "voice.hints.collapse" : "voice.hints.expand");
    if (!box.hidden) {
      render();
      syncPager();
    }
  };

  const toggle = (): void => {
    expanded = !expanded;
    try {
      localStorage.setItem(STORE_KEY, expanded ? "1" : "0");
    } catch {
      /* not remembered */
    }
    sync();
  };

  // The header is the only clickable part while closed; open, the list scrolls without the click
  // (or the wheel) reaching the map underneath. Mouse events are stopped too: the game's own
  // click handlers listen for mousedown/mouseup, not only for pointer events.
  for (const el of [head, body, foot]) {
    for (const type of ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "contextmenu"]) {
      el.addEventListener(type, (e) => e.stopPropagation());
    }
  }
  body.addEventListener("wheel", (e) => {
    e.stopPropagation();
    const w = e as WheelEvent;
    if (!w.deltaY && !w.deltaX) return;
    // Under mouse capture the match swallows the trusted wheel and replays it as a SYNTHETIC
    // event at the drawn cursor (ui/mouseCapture.ts). A synthetic WheelEvent performs no default
    // scrolling, so turn the notch into scrollTop here. A trusted event (pointer free) lets the
    // browser scroll the list itself.
    if (w.isTrusted) return;
    const unit = w.deltaMode === 1 ? 16 : w.deltaMode === 2 ? body.clientHeight : 1;
    body.scrollTop += w.deltaY * unit;
    body.scrollLeft += w.deltaX * unit;
  }, { passive: true });
  for (const btn of foot.querySelectorAll<HTMLButtonElement>(".voice-hints-page")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dir = Number(btn.dataset.dir) || 1;
      body.scrollTop += dir * Math.max(40, body.clientHeight * 0.85);
    });
  }
  head.addEventListener("click", () => toggle());

  // The race's names are known only once the match has its units: re-worded for a while after.
  const reword = window.setInterval(() => { if (!box.hidden) render(); }, 2000);
  window.addEventListener("resize", syncPager);

  const typing = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== VOICE_HINTS_KEY_CODE || !enabled || e.repeat || e.ctrlKey || e.altKey || e.metaKey || typing(e.target)) return;
    toggle();
  };
  window.addEventListener("keydown", onKey);

  return {
    setEnabled(on) {
      enabled = on;
      sync();
    },
    dispose() {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", syncPager);
      window.clearInterval(reword);
      box.remove();
    },
  };
}
