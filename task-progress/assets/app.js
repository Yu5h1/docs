import {
  STATUS_META,
  SUPPORTED_SCHEMA_VERSION,
  buildScopeHref,
  calculateProjectProgress,
  calculateTaskProgress,
  mergeReports,
  resolveReportRequest,
  validateScopeCatalog,
  validateDeveloperReport,
  validateReport,
} from "./report-model.js";
import { initializeThemeControls } from "./theme.js";

const elements = {
  title: document.querySelector("#report-title"),
  summary: document.querySelector("#report-summary"),
  scope: document.querySelector("#scope-label"),
  meta: document.querySelector("#report-meta"),
  updatedAt: document.querySelector("#updated-at"),
  reportId: document.querySelector("#report-id"),
  projectProgress: document.querySelector("#project-progress"),
  projectProgressValue: document.querySelector("#project-progress-value"),
  projectProgressMeter: document.querySelector("#project-progress-meter"),
  diagnostics: document.querySelector("#diagnostics"),
  content: document.querySelector("#report-content"),
  overview: document.querySelector("#overview-grid"),
  filters: document.querySelector("#status-filters"),
  taskList: document.querySelector("#task-list"),
  empty: document.querySelector("#empty-state"),
  start: document.querySelector("#start-panel"),
  startKicker: document.querySelector("#start-kicker"),
  startTitle: document.querySelector("#start-title"),
  startDescription: document.querySelector("#start-description"),
  exampleLink: document.querySelector("#example-link"),
  scopeDirectory: document.querySelector("#scope-directory"),
  modeBadge: document.querySelector("#mode-badge"),
};

const state = {
  report: null,
  tasks: [],
  filter: "all",
  diagnostics: [],
  developerAvailable: false,
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendList(parent, title, items, className = "") {
  if (!Array.isArray(items) || items.length === 0) return;
  const section = el("section", `detail-section ${className}`.trim());
  section.append(el("h4", "detail-heading", title));
  const list = el("ul", "detail-list");
  items.forEach((item) => list.append(el("li", "", item)));
  section.append(list);
  parent.append(section);
}

function safeReportUrl(value, label) {
  let url;
  try {
    url = new URL(value, document.baseURI);
  } catch {
    throw new Error(`${label} 不是有效的 URL。`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${label} 只支援 HTTP 或 HTTPS 來源。`);
  }
  return url;
}

async function fetchJson(value, label) {
  const url = safeReportUrl(value, label);
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`${label} 載入失敗（HTTP ${response.status}）。`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} 不是有效的 JSON。`);
  }
}

function formatTime(value) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return formatter.format(new Date(value));
}

function renderDiagnostics() {
  elements.diagnostics.replaceChildren();
  elements.diagnostics.hidden = state.diagnostics.length === 0;
  state.diagnostics.forEach((diagnostic) => {
    const item = el("div", `diagnostic diagnostic-${diagnostic.level ?? "error"}`);
    item.append(el("strong", "", diagnostic.level === "warning" ? "注意" : "無法載入部分資料"));
    item.append(el("p", "", diagnostic.message));
    elements.diagnostics.append(item);
  });
}

function renderOverview() {
  const counts = Object.fromEntries(Object.keys(STATUS_META).map((status) => [status, 0]));
  state.tasks.forEach((task) => { counts[task.status] += 1; });
  const cards = [
    { label: "目前進行", value: counts.in_progress, tone: "active" },
    { label: "已完成", value: counts.done, tone: "success" },
    { label: "受阻", value: counts.blocked, tone: "danger" },
    { label: "已封存", value: counts.archive, tone: "muted" },
  ];
  elements.overview.replaceChildren();
  cards.forEach((card) => {
    const item = el("article", `overview-card overview-${card.tone}`);
    item.append(el("span", "overview-value", String(card.value)));
    item.append(el("span", "overview-label", card.label));
    elements.overview.append(item);
  });
}

function renderProjectProgress() {
  const progress = calculateProjectProgress(state.tasks);
  elements.projectProgressValue.textContent = `整體約 ${progress.percentage}%`;
  elements.projectProgressMeter.value = progress.percentage;
  elements.projectProgressMeter.setAttribute(
    "aria-label",
    `整體進度 ${progress.percentage}%，已完成 ${progress.completed}，共 ${progress.total} 個進度單位`,
  );
  elements.projectProgress.hidden = false;
}

function renderFilters() {
  const filters = ["all", ...Object.keys(STATUS_META)];
  const counts = { all: state.tasks.length };
  Object.keys(STATUS_META).forEach((status) => {
    counts[status] = state.tasks.filter((task) => task.status === status).length;
  });
  elements.filters.replaceChildren();
  filters.forEach((filter) => {
    if (filter !== "all" && counts[filter] === 0) return;
    const label = filter === "all" ? "全部" : STATUS_META[filter].label;
    const button = el("button", "filter-button", `${label} ${counts[filter]}`);
    button.type = "button";
    button.dataset.filter = filter;
    button.setAttribute("aria-pressed", String(filter === state.filter));
    button.addEventListener("click", () => {
      state.filter = filter;
      renderFilters();
      renderTasks();
    });
    elements.filters.append(button);
  });
}

function renderDeveloperDetails(task, parent) {
  const developer = task.developer;
  if (!developer) return;
  const legacySteps = developer.next_steps ?? [];
  const nextAction = developer.next_step ?? legacySteps[0] ?? "尚未指定下一步";
  const followupSteps = developer.next_step ? legacySteps : legacySteps.slice(1);
  const hasDiscussion = Boolean(
    followupSteps.length
    || developer.blockers?.length
    || developer.decisions?.length
    || developer.routes?.length
    || developer.claim,
  );
  const details = el(hasDiscussion ? "details" : "section", "developer-details");
  const summary = el(hasDiscussion ? "summary" : "div", "developer-summary");
  summary.append(el("span", "developer-next-label", "Next Step :"));
  summary.append(el("span", "developer-next-action", nextAction));
  if (hasDiscussion) {
    summary.append(el("span", "developer-expand-hint", "展開作法與方向"));
  }
  details.append(summary);
  if (!hasDiscussion) {
    parent.append(details);
    return;
  }

  const body = el("div", "developer-body");
  body.append(el("h4", "developer-body-title", "作法與方向"));
  appendList(body, "後續動作", followupSteps, "next-steps");
  appendList(body, "Blockers", developer.blockers, "blockers");

  if (developer.decisions?.length) {
    const section = el("section", "detail-section");
    section.append(el("h4", "detail-heading", "Decisions"));
    const list = el("div", "decision-list");
    developer.decisions.forEach((decision) => {
      const item = el("article", "decision-item");
      item.append(el("p", "", decision.summary));
      if (decision.reference) item.append(el("code", "reference", decision.reference));
      list.append(item);
    });
    section.append(list);
    body.append(section);
  }

  if (developer.routes?.length) {
    const section = el("section", "detail-section");
    section.append(el("h4", "detail-heading", "Routes"));
    const list = el("div", "route-list");
    developer.routes.forEach((route) => {
      const item = el("article", "route-item");
      const heading = el("div", "route-heading");
      heading.append(el("strong", "", route.title));
      heading.append(el("span", `route-state route-${route.state}`, route.state));
      item.append(heading);
      if (route.reason) item.append(el("p", "", route.reason));
      list.append(item);
    });
    section.append(list);
    body.append(section);
  }

  if (developer.claim) {
    const section = el("section", "detail-section claim-section");
    section.append(el("h4", "detail-heading", "Claim"));
    section.append(el("p", "", `Agent: ${developer.claim.agent}`));
    if (developer.claim.worktree) section.append(el("p", "", `Worktree: ${developer.claim.worktree}`));
    if (developer.claim.source_paths?.length) {
      const paths = el("div", "path-list");
      developer.claim.source_paths.forEach((path) => paths.append(el("code", "reference", path)));
      section.append(paths);
    }
    body.append(section);
  }

  details.append(body);
  parent.append(details);
}

function renderTask(task) {
  const meta = STATUS_META[task.status];
  const progress = calculateTaskProgress(task);
  const card = el("article", `task-card status-${meta.tone}`);
  const header = el("header", "task-header");
  const titleGroup = el("div", "task-title-group");
  const headerMeta = el("div", "task-header-meta");
  const fraction = el("strong", "task-fraction", `${progress.completed} / ${progress.total}`);
  fraction.setAttribute(
    "aria-label",
    `子項目完成 ${progress.completed}，共 ${progress.total}`,
  );
  titleGroup.append(el("span", `status-badge status-${meta.tone}`, meta.label));
  titleGroup.append(el("h3", "", task.title));
  headerMeta.append(fraction, el("code", "task-id", task.id));
  header.append(titleGroup, headerMeta);
  card.append(header, el("p", "task-summary", task.summary));
  renderDeveloperDetails(task, card);

  if (task.completed_items?.length || task.pending_items?.length) {
    const columns = el("div", "work-columns");
    appendList(columns, "已完成", task.completed_items, "completed-work");
    appendList(columns, "尚未完成", task.pending_items, "pending-work");
    card.append(columns);
  }
  return card;
}

function renderTasks() {
  const tasks = state.filter === "all"
    ? state.tasks
    : state.tasks.filter((task) => task.status === state.filter);
  elements.taskList.replaceChildren(...tasks.map(renderTask));
  elements.empty.hidden = tasks.length !== 0;
}

function renderReport() {
  const { report } = state;
  document.title = `${report.title} — TaskProgress`;
  elements.title.textContent = report.title;
  elements.summary.textContent = `${report.tasks.length} 個可追溯任務；狀態由報告資料提供。`;
  elements.scope.textContent = report.scope_id;
  elements.updatedAt.textContent = formatTime(report.updated_at);
  elements.reportId.textContent = report.report_id;
  elements.meta.hidden = false;
  elements.content.hidden = false;
  elements.start.hidden = true;
  elements.modeBadge.hidden = !state.developerAvailable;
  renderDiagnostics();
  renderProjectProgress();
  renderOverview();
  renderFilters();
  renderTasks();
}

async function loadScopeCatalog() {
  const response = await fetch("task-progress-scopes.json", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`scope catalog 載入失敗（HTTP ${response.status}）。`);
  let catalog;
  try {
    catalog = await response.json();
  } catch {
    throw new Error("scope catalog 不是有效的 JSON。");
  }
  return validateScopeCatalog(catalog);
}

function renderScopeDirectory(scopes) {
  elements.scopeDirectory.replaceChildren();
  for (const scope of scopes) {
    const card = el("article", "scope-entry");
    const reportLink = el("a", "scope-link", scope.id);
    reportLink.href = buildScopeHref(scope.id);
    card.append(reportLink);
    if (scope.hasDeveloperReport) {
      const developerLink = el("a", "scope-developer-link", "Developer");
      developerLink.href = buildScopeHref(scope.id, true);
      card.append(developerLink);
    }
    elements.scopeDirectory.append(card);
  }
  elements.scopeDirectory.hidden = false;
}

async function showStart() {
  elements.title.textContent = "TaskProgress Viewer";
  elements.summary.textContent = "每個連結只載入指定 scope 的唯讀報告。";
  elements.scope.textContent = "尚未指定 report 或 scope";
  elements.startKicker.textContent = "Link-first viewer";
  elements.startTitle.textContent = "從報告連結開始";
  elements.startDescription.textContent = "公開報告可用 ?scope= 指定固定目錄；也可用 ?report= 指定完整報告路徑。需要內部細節時，再加入選用的 &dev=。";
  elements.exampleLink.hidden = false;
  elements.scopeDirectory.hidden = true;
  elements.start.hidden = false;
  elements.content.hidden = true;
  elements.meta.hidden = true;
  elements.projectProgress.hidden = true;

  try {
    const scopes = await loadScopeCatalog();
    if (!scopes || scopes.length === 0) return;
    elements.title.textContent = "TaskProgress Scopes";
    elements.summary.textContent = "選擇已由本機 Launcher 載入的任務報告。";
    elements.scope.textContent = `本機服務 · ${scopes.length} 個 scope`;
    elements.startKicker.textContent = "Local scope directory";
    elements.startTitle.textContent = "已註冊的 Scope";
    elements.startDescription.textContent = "這份清單只包含 scope ID，不會公開本機資料夾路徑。";
    elements.exampleLink.hidden = true;
    renderScopeDirectory(scopes);
  } catch (error) {
    state.diagnostics.push({
      level: "warning",
      message: error instanceof Error ? error.message : "scope catalog 無法載入。",
    });
    renderDiagnostics();
  }
}

function showFatal(message, details = []) {
  elements.title.textContent = "報告無法載入";
  elements.summary.textContent = "請檢查連結與資料格式後再試一次。";
  elements.scope.textContent = "資料診斷";
  elements.content.hidden = true;
  elements.projectProgress.hidden = true;
  state.diagnostics = [
    { level: "error", message },
    ...details.map((detail) => ({ level: "error", message: detail.message })),
  ];
  renderDiagnostics();
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  let request;
  try {
    request = resolveReportRequest(params);
  } catch (error) {
    showFatal(error instanceof Error ? error.message : "scope 無效。 ");
    return;
  }
  if (!request) {
    await showStart();
    return;
  }

  try {
    const report = await fetchJson(request.reportSource, "report.json");
    const errors = validateReport(report);
    if (report.schema_version !== SUPPORTED_SCHEMA_VERSION) {
      errors.unshift({ message: `Viewer 支援 schema ${SUPPORTED_SCHEMA_VERSION}，收到 ${report.schema_version ?? "未指定"}。` });
    }
    if (errors.length) {
      showFatal("report.json 未通過驗證。", errors);
      return;
    }

    let developerReport = null;
    const devSource = params.get("dev");
    if (devSource) {
      try {
        developerReport = await fetchJson(devSource, "report.dev.json");
        const developerErrors = validateDeveloperReport(developerReport);
        if (developerErrors.length) {
          state.diagnostics.push({
            level: "error",
            message: `report.dev.json 未通過驗證：${developerErrors.map((error) => error.message).join("；")}`,
          });
          developerReport = null;
        }
      } catch (error) {
        state.diagnostics.push({ level: "warning", message: error.message });
      }
    }

    const merged = mergeReports(report, developerReport);
    state.report = report;
    state.tasks = merged.tasks;
    state.developerAvailable = merged.developerAvailable;
    state.diagnostics.push(...merged.diagnostics);
    renderReport();
  } catch (error) {
    showFatal(error instanceof Error ? error.message : "發生未知錯誤。");
  }
}

initializeThemeControls();
main();
