import { LOCALES, currentLocale, currentLocaleLabel, otherLocaleLabel, setLocale, t, type Locale } from ".";

/**
 * The little corner button that flips the engine's own UI between the languages it ships.
 *
 * It shows the language in use and switches to the OTHER one on a press, then reloads: the
 * FDF screens layer their strings once at mount (src/i18n/index.ts explains why a reload is
 * the honest way to change them). Mounted by the load gate, the fallback menu and the FDF
 * main menu — the screens that exist before a match — so it is never in the way in game.
 */
export function createLanguageSwitch(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "language-switch";
  btn.textContent = t("language.switch", { language: currentLocaleLabel() });
  btn.title = t("language.next", { language: otherLocaleLabel() });
  btn.onclick = (): void => {
    const next = currentLocale() === "zhCN" ? "enUS" : "zhCN";
    setLocale(next);
    // The URL's `?lang=` OUTRANKS the stored choice (index.ts currentLocale), so reloading as-is
    // would just re-apply the old one whenever the page was opened with `?lang=`. Carry the pick
    // into the URL and every other parameter (?dev, the chapter) survives the reload.
    const url = new URL(location.href);
    url.searchParams.set("lang", next);
    window.location.replace(url.toString());
  };
  return btn;
}

/**
 * The launcher's language CHOICE: every language listed by name, the one in use already
 * selected — rather than the corner's "switch to the other one", because the load screen is
 * where a player arrives before they can read anything, and picking from a list is the one
 * answer that works for more than two languages later on.
 *
 * Same reload as the toggle, and for the same reason: an FDF screen layers its strings once at
 * mount. `?lang=` is carried into the URL so the pick outranks the stored one.
 */
export function createLanguagePicker(): HTMLElement {
  // A menu this file draws itself rather than a <select>: two native quirks made the picker look
  // dead. A <label> wrapping a <select> is forwarded a click that OPENS and CLOSES the popup in
  // one tap on WebKit, and Chrome focuses the control without opening it — so a tap on the
  // caption did nothing anywhere. Here the caption is part of the button, and the list is our
  // own, so a press always opens it.
  const wrap = document.createElement("div");
  wrap.className = "language-picker";
  wrap.setAttribute("role", "group");
  const caption = document.createElement("span");
  caption.className = "language-picker__caption";
  caption.id = `language-picker-${(pickerCount += 1)}`;
  caption.textContent = t("language.label");

  const control = document.createElement("div");
  control.className = "language-picker__control";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "language-picker__button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-labelledby", caption.id);
  const value = document.createElement("span");
  value.className = "language-picker__value";
  value.textContent = currentLocaleLabel();
  const chevron = document.createElement("span");
  chevron.className = "language-picker__chevron";
  chevron.setAttribute("aria-hidden", "true");
  button.append(value, chevron);

  const menu = document.createElement("ul");
  menu.className = "language-picker__menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  const options: HTMLLIElement[] = [];
  for (const { id, label } of LOCALES) {
    const option = document.createElement("li");
    option.className = "language-picker__option";
    option.setAttribute("role", "option");
    option.tabIndex = -1;
    option.dataset.locale = id;
    option.textContent = label;
    option.setAttribute("aria-selected", String(id === currentLocale()));
    menu.append(option);
    options.push(option);
  }

  /** One shot: the reload is the point, and a second pick while it runs must not race it. */
  let applying = false;
  const choose = (id: string): void => {
    if (applying || id === currentLocale()) {
      close();
      return;
    }
    applying = true;
    setLocale(id as Locale);
    // The URL's `?lang=` OUTRANKS the stored choice (index.ts currentLocale), so the pick has to
    // travel in it; every other parameter (?dev, the chapter) survives the reload.
    const url = new URL(location.href);
    url.searchParams.set("lang", id);
    window.location.replace(url.toString());
  };

  const outside = (e: PointerEvent): void => {
    if (!wrap.contains(e.target as Node)) close();
  };
  function open(): void {
    if (!menu.hidden) return;
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    // The pointerdown fires before any click on the page, so a press anywhere else closes the
    // menu without stealing the press from what it was aimed at.
    document.addEventListener("pointerdown", outside, true);
    (options.find((o) => o.dataset.locale === currentLocale()) ?? options[0])?.focus();
  }
  function close(): void {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
  }

  button.onclick = (): void => (menu.hidden ? open() : close());
  // The caption is part of the control the player sees, so it must behave like it: a press on
  // "语言" opens the same menu (a native label would have swallowed it).
  caption.addEventListener("click", () => button.click());
  button.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      open();
    }
  });
  menu.addEventListener("keydown", (e) => {
    const at = options.indexOf(document.activeElement as HTMLLIElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = options[(at + step + options.length) % options.length];
      next.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (at >= 0) choose(options[at].dataset.locale ?? "");
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      button.focus();
    }
  });
  menu.addEventListener("click", (e) => {
    const option = (e.target as Element).closest<HTMLLIElement>(".language-picker__option");
    if (option) choose(option.dataset.locale ?? "");
  });

  control.append(button, menu);
  wrap.append(caption, control);
  return wrap;
}

/** Unique ids for the caption each picker gets (there is one per launcher mount, and a rebuild
 *  must not hand two controls the same name). */
let pickerCount = 0;
