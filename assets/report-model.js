export const SUPPORTED_SCHEMA_VERSION = "1.0";

export const STATUS_META = Object.freeze({
  planned: { label: "待規劃", tone: "neutral" },
  in_progress: { label: "進行中", tone: "active" },
  blocked: { label: "受阻", tone: "danger" },
  done: { label: "已完成", tone: "success" },
  archive: { label: "已封存", tone: "muted" },
});

const ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function validateScopeCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error("scope catalog 的根節點必須是物件。");
  }
  if (catalog.schema_version !== "1.0" || !Array.isArray(catalog.scopes)) {
    throw new Error("scope catalog 格式不相容。");
  }

  const seen = new Set();
  return catalog.scopes.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
      || typeof entry.id !== "string" || entry.id.length > 100
      || !ID_PATTERN.test(entry.id)
      || typeof entry.has_developer_report !== "boolean"
      || seen.has(entry.id)) {
      throw new Error("scope catalog 包含無效或重複的 scope。");
    }
    seen.add(entry.id);
    return {
      id: entry.id,
      hasDeveloperReport: entry.has_developer_report,
    };
  });
}

export function buildScopeHref(scope, developer = false) {
  if (typeof scope !== "string" || scope.length > 100 || !ID_PATTERN.test(scope)) {
    throw new Error("scope 無效。");
  }
  const params = new URLSearchParams({ scope });
  if (developer) params.set("dev", `reports/${scope}/report.dev.json`);
  return `?${params}`;
}

export function resolveReportRequest(params) {
  const explicitReport = params.get("report");
  if (explicitReport) {
    return { source: "report", reportSource: explicitReport, scope: null };
  }

  const scope = params.get("scope");
  if (!scope) return null;
  if (scope.length > 100 || !ID_PATTERN.test(scope)) {
    throw new Error("scope 必須是小寫英數字組成的穩定 ID，可使用點、底線或連字號。");
  }
  return {
    source: "scope",
    reportSource: `reports/${scope}/report.json`,
    scope,
  };
}

export function calculateTaskProgress(task) {
  if (task.progress) return { ...task.progress };

  const completedItems = task.completed_items?.length ?? 0;
  const pendingItems = task.pending_items?.length ?? 0;
  if (completedItems + pendingItems > 0) {
    return { completed: completedItems, total: completedItems + pendingItems };
  }

  return { completed: task.status === "done" ? 1 : 0, total: 1 };
}

export function calculateProjectProgress(tasks) {
  const progress = tasks
    .filter((task) => task.status !== "archive")
    .map(calculateTaskProgress);
  const completed = progress.reduce((sum, item) => sum + item.completed, 0);
  const total = progress.reduce((sum, item) => sum + item.total, 0);
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percentage };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function issue(code, path, message) {
  return { code, path, message };
}

function requireString(value, path, errors, options = {}) {
  const { id = false } = options;
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(issue("invalid_string", path, `${path} 必須是非空白文字。`));
    return;
  }
  if (id && !ID_PATTERN.test(value)) {
    errors.push(issue("invalid_id", path, `${path} 不是有效的穩定 ID。`));
  }
}

function validateStringList(value, path, errors) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(issue("invalid_list", path, `${path} 必須是文字陣列。`));
    return;
  }
  value.forEach((item, index) => requireString(item, `${path}[${index}]`, errors));
}

function validateTimestamp(value, path, errors) {
  requireString(value, path, errors);
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) {
    errors.push(issue("invalid_timestamp", path, `${path} 必須是有效的 date-time。`));
  }
}

export function validateReport(report) {
  const errors = [];
  if (!isObject(report)) {
    return [issue("invalid_report", "$", "report.json 的根節點必須是物件。")];
  }

  requireString(report.schema_version, "schema_version", errors);
  requireString(report.report_id, "report_id", errors, { id: true });
  requireString(report.scope_id, "scope_id", errors, { id: true });
  requireString(report.title, "title", errors);
  validateTimestamp(report.updated_at, "updated_at", errors);

  if (!Array.isArray(report.tasks)) {
    errors.push(issue("invalid_tasks", "tasks", "tasks 必須是陣列。"));
    return errors;
  }

  const ids = new Set();
  report.tasks.forEach((task, index) => {
    const path = `tasks[${index}]`;
    if (!isObject(task)) {
      errors.push(issue("invalid_task", path, `${path} 必須是物件。`));
      return;
    }
    requireString(task.id, `${path}.id`, errors, { id: true });
    requireString(task.title, `${path}.title`, errors);
    requireString(task.summary, `${path}.summary`, errors);
    if (!Object.hasOwn(STATUS_META, task.status)) {
      errors.push(issue("invalid_status", `${path}.status`, `${path}.status 不是支援的狀態。`));
    }
    if (typeof task.id === "string") {
      if (ids.has(task.id)) {
        errors.push(issue("duplicate_task", `${path}.id`, `task id「${task.id}」重複。`));
      }
      ids.add(task.id);
    }
    validateStringList(task.completed_items, `${path}.completed_items`, errors);
    validateStringList(task.pending_items, `${path}.pending_items`, errors);

    if (task.progress !== undefined) {
      if (!isObject(task.progress)) {
        errors.push(issue("invalid_progress", `${path}.progress`, `${path}.progress 必須是物件。`));
      } else {
        const { completed, total } = task.progress;
        if (!Number.isInteger(completed) || completed < 0) {
          errors.push(issue("invalid_progress", `${path}.progress.completed`, "completed 必須是非負整數。"));
        }
        if (!Number.isInteger(total) || total < 1) {
          errors.push(issue("invalid_progress", `${path}.progress.total`, "total 必須是大於零的整數。"));
        }
        if (Number.isInteger(completed) && Number.isInteger(total) && completed > total) {
          errors.push(issue("invalid_progress", `${path}.progress`, "completed 不可大於 total。"));
        }
      }
    }
  });

  return errors;
}

export function validateDeveloperReport(report) {
  const errors = [];
  if (!isObject(report)) {
    return [issue("invalid_report", "$", "report.dev.json 的根節點必須是物件。")];
  }

  requireString(report.schema_version, "schema_version", errors);
  requireString(report.report_id, "report_id", errors, { id: true });
  validateTimestamp(report.updated_at, "updated_at", errors);
  if (!Array.isArray(report.tasks)) {
    errors.push(issue("invalid_tasks", "tasks", "Developer tasks 必須是陣列。"));
    return errors;
  }

  const ids = new Set();
  report.tasks.forEach((task, index) => {
    const path = `tasks[${index}]`;
    if (!isObject(task)) {
      errors.push(issue("invalid_task", path, `${path} 必須是物件。`));
      return;
    }
    requireString(task.id, `${path}.id`, errors, { id: true });
    if (typeof task.id === "string") {
      if (ids.has(task.id)) {
        errors.push(issue("duplicate_task", `${path}.id`, `Developer task id「${task.id}」重複。`));
      }
      ids.add(task.id);
    }
    if (task.next_step !== undefined) {
      requireString(task.next_step, `${path}.next_step`, errors);
    }
    validateStringList(task.next_steps, `${path}.next_steps`, errors);
    validateStringList(task.blockers, `${path}.blockers`, errors);

    if (task.decisions !== undefined) {
      if (!Array.isArray(task.decisions)) {
        errors.push(issue("invalid_decisions", `${path}.decisions`, "decisions 必須是陣列。"));
      } else {
        task.decisions.forEach((decision, decisionIndex) => {
          const decisionPath = `${path}.decisions[${decisionIndex}]`;
          if (!isObject(decision)) {
            errors.push(issue("invalid_decision", decisionPath, `${decisionPath} 必須是物件。`));
            return;
          }
          requireString(decision.summary, `${decisionPath}.summary`, errors);
          if (decision.reference !== undefined) {
            requireString(decision.reference, `${decisionPath}.reference`, errors);
          }
        });
      }
    }

    if (task.routes !== undefined) {
      if (!Array.isArray(task.routes)) {
        errors.push(issue("invalid_routes", `${path}.routes`, "routes 必須是陣列。"));
      } else {
        task.routes.forEach((route, routeIndex) => {
          const routePath = `${path}.routes[${routeIndex}]`;
          if (!isObject(route)) {
            errors.push(issue("invalid_route", routePath, `${routePath} 必須是物件。`));
            return;
          }
          requireString(route.title, `${routePath}.title`, errors);
          if (!["candidate", "selected", "rejected"].includes(route.state)) {
            errors.push(issue("invalid_route_state", `${routePath}.state`, `${routePath}.state 不受支援。`));
          }
          if (route.reason !== undefined) requireString(route.reason, `${routePath}.reason`, errors);
        });
      }
    }

    if (task.claim !== undefined) {
      if (!isObject(task.claim)) {
        errors.push(issue("invalid_claim", `${path}.claim`, "claim 必須是物件。"));
      } else {
        requireString(task.claim.agent, `${path}.claim.agent`, errors);
        if (task.claim.worktree !== undefined) {
          requireString(task.claim.worktree, `${path}.claim.worktree`, errors);
        }
        validateStringList(task.claim.source_paths, `${path}.claim.source_paths`, errors);
      }
    }
  });

  return errors;
}

export function mergeReports(report, developerReport = null) {
  const diagnostics = [];
  const tasks = report.tasks.map((task) => ({ ...task, developer: null }));
  if (!developerReport) return { tasks, diagnostics, developerAvailable: false };

  if (developerReport.schema_version !== report.schema_version) {
    diagnostics.push({
      level: "error",
      code: "schema_mismatch",
      message: `Developer Report 版本 ${developerReport.schema_version} 與基本報告 ${report.schema_version} 不相容，已忽略擴充資料。`,
    });
    return { tasks, diagnostics, developerAvailable: false };
  }
  if (developerReport.report_id !== report.report_id) {
    diagnostics.push({
      level: "error",
      code: "report_id_mismatch",
      message: "Developer Report 的 report_id 與基本報告不同，已忽略擴充資料。",
    });
    return { tasks, diagnostics, developerAvailable: false };
  }

  const overlays = new Map(developerReport.tasks.map((task) => [task.id, task]));
  const taskIds = new Set(report.tasks.map((task) => task.id));
  for (const overlay of developerReport.tasks) {
    if (!taskIds.has(overlay.id)) {
      diagnostics.push({
        level: "warning",
        code: "orphan_developer_task",
        message: `Developer task「${overlay.id}」找不到對應的觀看者 task，未進行猜測配對。`,
      });
    }
  }

  for (const task of tasks) {
    task.developer = overlays.get(task.id) ?? null;
  }
  return { tasks, diagnostics, developerAvailable: true };
}
