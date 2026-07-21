export const THEME_STORAGE_KEY = "task-progress.theme.v1";

export const THEME_MODES = ["system", "light", "dark", "custom"];

export const CUSTOM_COLOR_FIELDS = [
  { key: "pageBackground", cssVariable: "--color-page-bg", label: "頁面背景" },
  { key: "panelBackground", cssVariable: "--color-panel-bg", label: "面板背景" },
  { key: "heading", cssVariable: "--color-heading", label: "大標題" },
  { key: "panelHeading", cssVariable: "--color-panel-heading", label: "面板標題" },
  { key: "itemText", cssVariable: "--color-item-text", label: "項目文字" },
  { key: "secondaryText", cssVariable: "--color-secondary-text", label: "次要文字" },
  { key: "border", cssVariable: "--color-border", label: "邊框與分隔線" },
  { key: "accent", cssVariable: "--color-accent", label: "強調色" },
];

export const DEFAULT_CUSTOM_PALETTES = Object.freeze({
  light: Object.freeze({
    pageBackground: "#f5f3ec",
    panelBackground: "#fffdf8",
    heading: "#17211d",
    panelHeading: "#17211d",
    itemText: "#27342e",
    secondaryText: "#4f5e57",
    border: "#dcd9cf",
    accent: "#1f684f",
  }),
  dark: Object.freeze({
    pageBackground: "#111714",
    panelBackground: "#19211d",
    heading: "#edf3ef",
    panelHeading: "#e4ebe7",
    itemText: "#d5ddd8",
    secondaryText: "#aebbb4",
    border: "#35423b",
    accent: "#70c49c",
  }),
});

const DEFAULT_PREFERENCE = Object.freeze({ version: 1, mode: "system" });
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isHexColor(value) {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function createCustomPalette(base = "light", colors = {}) {
  const safeBase = base === "dark" ? "dark" : "light";
  const defaults = DEFAULT_CUSTOM_PALETTES[safeBase];
  const palette = { base: safeBase };
  for (const field of CUSTOM_COLOR_FIELDS) {
    const candidate = colors[field.key];
    palette[field.key] = isHexColor(candidate) ? candidate.toLowerCase() : defaults[field.key];
  }
  return palette;
}

export function normalizeThemePreference(value) {
  if (!isObject(value) || value.version !== 1 || !THEME_MODES.includes(value.mode)) {
    return { ...DEFAULT_PREFERENCE };
  }

  const normalized = { version: 1, mode: value.mode };
  if (isObject(value.custom)) {
    normalized.custom = createCustomPalette(value.custom.base, value.custom);
  } else if (value.mode === "custom") {
    normalized.custom = createCustomPalette();
  }
  return normalized;
}

export function loadThemePreference(storage) {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return stored ? normalizeThemePreference(JSON.parse(stored)) : { ...DEFAULT_PREFERENCE };
  } catch {
    return { ...DEFAULT_PREFERENCE };
  }
}

export function saveThemePreference(storage, preference) {
  const normalized = normalizeThemePreference(preference);
  try {
    storage?.setItem(THEME_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The selected theme still applies for this page when storage is unavailable.
  }
  return normalized;
}

export function resolveSystemScheme(matchMedia) {
  try {
    return matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyThemePreference(root, preference) {
  const normalized = normalizeThemePreference(preference);
  root.dataset.theme = normalized.mode;

  for (const field of CUSTOM_COLOR_FIELDS) {
    root.style.removeProperty(field.cssVariable);
  }
  delete root.dataset.themeBase;

  if (normalized.mode === "custom") {
    const custom = normalized.custom ?? createCustomPalette();
    root.dataset.themeBase = custom.base;
    for (const field of CUSTOM_COLOR_FIELDS) {
      root.style.setProperty(field.cssVariable, custom[field.key]);
    }
    root.style.colorScheme = custom.base;
  } else if (normalized.mode === "system") {
    root.style.colorScheme = "light dark";
  } else {
    root.style.colorScheme = normalized.mode;
  }
  return normalized;
}

export function preferenceWithMode(preference, mode, systemScheme = "light") {
  const current = normalizeThemePreference(preference);
  const next = { version: 1, mode };
  if (current.custom) next.custom = current.custom;
  if (mode === "custom" && !next.custom) {
    next.custom = createCustomPalette(systemScheme);
  }
  return normalizeThemePreference(next);
}

function channelToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground, background) {
  if (!isHexColor(foreground) || !isHexColor(background)) return 1;
  const luminance = (hex) => {
    const value = hex.slice(1);
    const channels = [0, 2, 4].map((offset) => channelToLinear(Number.parseInt(value.slice(offset, offset + 2), 16)));
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function getContrastWarnings(palette) {
  const checks = [
    ["大標題", palette.heading, palette.pageBackground],
    ["面板標題", palette.panelHeading, palette.panelBackground],
    ["項目文字", palette.itemText, palette.panelBackground],
    ["次要文字", palette.secondaryText, palette.panelBackground],
  ];
  return checks
    .filter(([, foreground, background]) => contrastRatio(foreground, background) < 4.5)
    .map(([label]) => `${label}對比低於 4.5:1`);
}
