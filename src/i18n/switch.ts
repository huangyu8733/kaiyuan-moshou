import { currentLocale, currentLocaleLabel, otherLocaleLabel, setLocale, t } from ".";

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
    setLocale(currentLocale() === "zhCN" ? "enUS" : "zhCN");
    window.location.reload();
  };
  return btn;
}
