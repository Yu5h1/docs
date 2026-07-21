import {
  CUSTOM_COLOR_FIELDS,
  applyThemePreference,
  createCustomPalette,
  getContrastWarnings,
  loadThemePreference,
  preferenceWithMode,
  resolveSystemScheme,
  saveThemePreference,
} from "./theme-model.js";

function setDialogStatus(element, palette) {
  const warnings = getContrastWarnings(palette);
  element.classList.toggle("theme-status-warning", warnings.length > 0);
  element.textContent = warnings.length
    ? `注意：${warnings.join("；")}。仍可套用，但可能較難閱讀。`
    : "目前的文字與背景色彩對比符合 4.5:1。";
}

export function initializeThemeControls({
  root = document.documentElement,
  storage = window.localStorage,
  matchMedia = window.matchMedia.bind(window),
} = {}) {
  const select = document.querySelector("#theme-select");
  const dialog = document.querySelector("#theme-dialog");
  const baseSelect = document.querySelector("#theme-custom-base");
  const fields = document.querySelector("#theme-color-fields");
  const status = document.querySelector("#theme-dialog-status");
  const applyButton = document.querySelector("#theme-apply");
  const cancelButton = document.querySelector("#theme-cancel");
  const closeButton = document.querySelector("#theme-close");
  const resetButton = document.querySelector("#theme-reset");
  if (!select || !dialog || !baseSelect || !fields || !status || !applyButton || !cancelButton || !closeButton || !resetButton) {
    return;
  }

  let preference = applyThemePreference(root, loadThemePreference(storage));
  let draft = preference.custom ?? createCustomPalette(resolveSystemScheme(matchMedia));
  select.value = preference.mode;

  const inputs = new Map();
  fields.replaceChildren();
  for (const field of CUSTOM_COLOR_FIELDS) {
    const row = document.createElement("label");
    row.className = "theme-color-field";
    const label = document.createElement("span");
    label.textContent = field.label;
    const controls = document.createElement("span");
    controls.className = "theme-color-controls";
    const picker = document.createElement("input");
    picker.type = "color";
    picker.setAttribute("aria-label", `${field.label}選色器`);
    const text = document.createElement("input");
    text.type = "text";
    text.inputMode = "text";
    text.maxLength = 7;
    text.pattern = "#[0-9a-fA-F]{6}";
    text.setAttribute("aria-label", `${field.label}十六進位色碼`);
    controls.append(picker, text);
    row.append(label, controls);
    fields.append(row);
    inputs.set(field.key, { picker, text });
  }

  function collectDraft() {
    const colors = {};
    for (const field of CUSTOM_COLOR_FIELDS) {
      colors[field.key] = inputs.get(field.key).text.value;
    }
    return createCustomPalette(baseSelect.value, colors);
  }

  function updateDraft(nextDraft) {
    draft = createCustomPalette(nextDraft.base, nextDraft);
    baseSelect.value = draft.base;
    for (const field of CUSTOM_COLOR_FIELDS) {
      const controls = inputs.get(field.key);
      controls.picker.value = draft[field.key];
      controls.text.value = draft[field.key];
      controls.text.setCustomValidity("");
    }
    setDialogStatus(status, draft);
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function openCustomDialog() {
    updateDraft(preference.custom ?? createCustomPalette(resolveSystemScheme(matchMedia)));
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  for (const field of CUSTOM_COLOR_FIELDS) {
    const controls = inputs.get(field.key);
    controls.picker.addEventListener("input", () => {
      controls.text.value = controls.picker.value;
      draft = collectDraft();
      setDialogStatus(status, draft);
    });
    controls.text.addEventListener("input", () => {
      const valid = /^#[0-9a-f]{6}$/i.test(controls.text.value);
      controls.text.setCustomValidity(valid ? "" : "請輸入 #RRGGBB 格式的色碼");
      if (valid) {
        controls.picker.value = controls.text.value;
        draft = collectDraft();
        setDialogStatus(status, draft);
      }
    });
  }

  select.addEventListener("change", () => {
    if (select.value === "custom") {
      openCustomDialog();
      return;
    }
    preference = preferenceWithMode(preference, select.value, resolveSystemScheme(matchMedia));
    preference = saveThemePreference(storage, preference);
    applyThemePreference(root, preference);
  });

  baseSelect.addEventListener("change", () => {
    updateDraft(createCustomPalette(baseSelect.value));
  });

  resetButton.addEventListener("click", () => {
    updateDraft(createCustomPalette(baseSelect.value));
  });

  const cancelCustomTheme = () => {
    select.value = preference.mode;
    closeDialog();
  };
  cancelButton.addEventListener("click", cancelCustomTheme);
  closeButton.addEventListener("click", cancelCustomTheme);

  applyButton.addEventListener("click", () => {
    const invalid = [...inputs.values()].map(({ text }) => text).find((input) => !input.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    draft = collectDraft();
    preference = saveThemePreference(storage, { version: 1, mode: "custom", custom: draft });
    applyThemePreference(root, preference);
    select.value = "custom";
    closeDialog();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    select.value = preference.mode;
    closeDialog();
  });
}
