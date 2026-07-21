(() => {
  const modes = new Set(["system", "light", "dark", "custom"]);
  const colors = {
    pageBackground: "--color-page-bg",
    panelBackground: "--color-panel-bg",
    heading: "--color-heading",
    panelHeading: "--color-panel-heading",
    itemText: "--color-item-text",
    secondaryText: "--color-secondary-text",
    border: "--color-border",
    accent: "--color-accent",
  };
  const root = document.documentElement;
  const isHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

  try {
    const saved = JSON.parse(localStorage.getItem("task-progress.theme.v1"));
    if (saved?.version !== 1 || !modes.has(saved.mode)) return;
    root.dataset.theme = saved.mode;
    if (saved.mode !== "custom" || !saved.custom) return;
    root.dataset.themeBase = saved.custom.base === "dark" ? "dark" : "light";
    Object.entries(colors).forEach(([key, cssVariable]) => {
      if (isHex(saved.custom[key])) root.style.setProperty(cssVariable, saved.custom[key]);
    });
  } catch {
    // Invalid or unavailable local storage falls back to the system preference.
  }
})();
