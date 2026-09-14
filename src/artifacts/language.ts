export const languageCss = `
[data-aha-lang][hidden] { display: none !important; }
.aha-language-controls { display: flex; gap: .5rem; padding: .75rem 1rem; flex-wrap: wrap; }
.aha-language-controls button[aria-pressed="true"] { border-color: var(--cp-accent); font-weight: bold; }
`;

export const languageScript = `(() => {
  const roots = Array.from(document.querySelectorAll("[data-aha-lang]"));
  const controls = document.createElement("nav");
  controls.className = "aha-language-controls";
  controls.setAttribute("aria-label", "Language / 语言");
  const buttons = [];
  function select(language) {
    for (const root of roots) {
      root.hidden = root.dataset.ahaLang !== language;
      if (!root.hidden) document.title = root.dataset.ahaTitle;
    }
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.language === language));
    window.dispatchEvent(new CustomEvent("aha:languagechange", { detail: { language } }));
  }
  for (const [language, label] of [["en", "English"], ["zh", "中文"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.lang = language === "zh" ? "zh-CN" : "en";
    button.textContent = label;
    button.dataset.language = language;
    button.addEventListener("click", () => select(language));
    buttons.push(button);
    controls.append(button);
  }
  document.body.prepend(controls);
  select("en");
})();`;
