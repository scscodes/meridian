/**
 * Git Analytics Webview Script
 * Handles data visualization and user interactions
 */

// Reference to VS Code API (in real extension)
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

let analyticsData = null;
let chartInstances = {};

// Top-5 vivid colors + gray for "Other"
const DONUT_PALETTE = ["#06b6d4", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#6b7280"];

// Risk Hotspots scatter: cap points (top by volatility) so the chart stays
// readable/fast on large histories; tooltip carries the full path so the cap
// never hides a file's identity. Radius bounds in px; area (perceived size)
// scales linearly with total lines via a sqrt mapping.
const HOTSPOT_MAX_POINTS = 60;
const HOTSPOT_MIN_R = 3;
const HOTSPOT_MAX_R = 22;
const RISK_COLORS = {
  high:   { fill: "rgba(239, 68, 68, 0.55)",  border: "#ef4444" },
  medium: { fill: "rgba(245, 158, 11, 0.55)", border: "#f59e0b" },
  low:    { fill: "rgba(34, 197, 94, 0.50)",  border: "#22c55e" },
};

/**
 * Pure: map FileMetric[] → bubble points, capped to the top
 * HOTSPOT_MAX_POINTS by volatility. Returns [] for empty/missing input.
 * Extra fields (path, lines, risk) ride along for the tooltip; Chart.js
 * reads only {x, y, r}.
 */
function hotspotPoints(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (list.length === 0) return [];

  const top = list
    .slice()
    .sort((a, b) => (b.volatility || 0) - (a.volatility || 0))
    .slice(0, HOTSPOT_MAX_POINTS);

  const maxLines = Math.max(
    1,
    ...top.map((f) => (f.insertions || 0) + (f.deletions || 0))
  );

  return top.map((f) => {
    const lines = (f.insertions || 0) + (f.deletions || 0);
    const scaled =
      HOTSPOT_MIN_R +
      Math.sqrt(lines / maxLines) * (HOTSPOT_MAX_R - HOTSPOT_MIN_R);
    const r = Math.max(HOTSPOT_MIN_R, Math.min(HOTSPOT_MAX_R, scaled));
    return {
      x: f.commitCount || 0,
      y: f.volatility || 0,
      r,
      lines,
      path: normalizeGitPath(f.path || ""),
      risk: RISK_COLORS[f.risk] ? f.risk : "low",
    };
  });
}

/**
 * Post a refresh request to the extension with the current period selection.
 */
function postRefresh() {
  const period = document.getElementById("period")?.value || "3mo";
  vscode?.postMessage({ type: "refresh", payload: { period } });
}

/**
 * Listen for messages from the extension
 */
if (vscode) {
  window.addEventListener("message", (event) => {
    const msg = event.data;

    if (msg.type === "loading") {
      document.body.classList.add("meridian-loading");
      return;
    }
    if (msg.type === "init") {
      document.body.classList.remove("meridian-loading");
      analyticsData = msg.payload;
      renderUI();
      return;
    }
    if (msg.type === "error") {
      document.body.classList.remove("meridian-loading");
    }
  });

  // Initial data arrives via the buffered "init" message posted by openPanel()
}

/**
 * Render entire UI
 */
function renderUI() {
  if (!analyticsData) {
    console.error("No analytics data available");
    return;
  }

  updateSummary();
  renderCharts();
  renderTables();
}

/**
 * Update summary cards with narrative averages
 */
function updateSummary() {
  const s = analyticsData.summary;

  setText("commitFreq",      s.commitFrequency.toFixed(1));
  setText("filesPerCommit",  s.totalCommits > 0
    ? (s.totalFilesModified / s.totalCommits).toFixed(1) : "—");
  setText("avgInsPerCommit", s.totalCommits > 0
    ? Math.round(s.totalLinesAdded   / s.totalCommits) : "—");
  setText("avgDelPerCommit", s.totalCommits > 0
    ? Math.round(s.totalLinesDeleted / s.totalCommits) : "—");
  setText("churnRate",       s.churnRate.toFixed(2));
}

/**
 * Render all charts
 */
function renderCharts() {
  renderChurnByFileTypeChart();
  renderChurnByDirectoryChart();
  renderHotspotChart();
}

/**
 * Render the Risk Hotspots scatter: one bubble dataset per risk tier so the
 * legend doubles as a risk filter. x = change frequency, y = volatility,
 * bubble area ∝ total lines changed.
 */
function renderHotspotChart() {
  const ctx = document.getElementById("hotspotChart");
  if (!ctx) return;

  if (chartInstances.hotspot) {
    chartInstances.hotspot.destroy();
  }

  const points = hotspotPoints(analyticsData.files || []);
  if (points.length === 0) return;

  const tiers = ["high", "medium", "low"];
  const datasets = tiers
    .map((tier) => ({
      label: tier[0].toUpperCase() + tier.slice(1) + " risk",
      data: points.filter((p) => p.risk === tier),
      backgroundColor: RISK_COLORS[tier].fill,
      borderColor: RISK_COLORS[tier].border,
      borderWidth: 1,
    }))
    .filter((d) => d.data.length > 0);

  chartInstances.hotspot = new Chart(ctx, {
    type: "bubble",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Commits (change frequency)", color: "#9ca3af" },
          ticks: { color: "#9ca3af", precision: 0 },
          grid: { color: "rgba(255,255,255,0.06)" },
          beginAtZero: true,
        },
        y: {
          title: { display: true, text: "Volatility (lines / commit)", color: "#9ca3af" },
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(255,255,255,0.06)" },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#e8e8e8", padding: 12, font: { size: 12 }, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const p = item.raw;
              return `${p.path} — ${p.x} commit${p.x === 1 ? "" : "s"}, ` +
                `volatility ${Number(p.y).toFixed(1)}, ${p.lines} lines`;
            },
          },
        },
      },
    },
  });
}

/**
 * Normalize git rename notation to the destination path.
 * Defense-in-depth layer; backend normalizes first.
 *   "src/{old => new}/f.ts"  → "src/new/f.ts"
 *   "old.ts => new.ts"       → "new.ts"
 */
function normalizeGitPath(p) {
  if (p.includes(" => ")) {
    if (p.includes("{")) return p.replace(/\{[^}]* => ([^}]*)\}/g, "$1");
    return p.split(" => ").pop();
  }
  return p;
}

/**
 * Render churn grouped by file extension (donut, top 5 + Other)
 */
function renderChurnByFileTypeChart() {
  const ctx = document.getElementById("churnByTypeChart");
  if (!ctx) return;

  if (chartInstances.churnByType) {
    chartInstances.churnByType.destroy();
  }

  const files = analyticsData.files || [];
  const byExt = {};
  for (const f of files) {
    const normalizedPath = normalizeGitPath(f.path);
    const parts = normalizedPath.split(".");
    const ext = parts.length > 1 ? "." + parts.pop() : "(none)";
    byExt[ext] = (byExt[ext] || 0) + f.volatility;
  }

  const sorted = Object.entries(byExt).sort((a, b) => b[1] - a[1]);
  const top5   = sorted.slice(0, 5);
  const other  = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
  const labels = [...top5.map(([k]) => k), ...(other > 0 ? ["Other"] : [])];
  const data   = [...top5.map(([, v]) => v), ...(other > 0 ? [other] : [])];

  chartInstances.churnByType = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: DONUT_PALETTE.slice(0, data.length),
        borderColor: "#1e1e1e",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          align: "center",
          labels: { color: "#e8e8e8", padding: 10, font: { size: 12 }, boxWidth: 12 },
        },
      },
    },
  });
}

/**
 * Render churn grouped by immediate parent directory (donut, top 5 + Other)
 *
 * Uses the direct parent folder of each file rather than the top-level
 * directory, so deeply-nested files (e.g. src/domains/git/service.ts)
 * are attributed to "git", not "src".
 */
function renderChurnByDirectoryChart() {
  const ctx = document.getElementById("churnByDirChart");
  if (!ctx) return;

  if (chartInstances.churnByDir) {
    chartInstances.churnByDir.destroy();
  }

  const files = analyticsData.files || [];
  const byDir = {};
  for (const f of files) {
    const normalizedPath = normalizeGitPath(f.path);
    const parts = normalizedPath.split("/");
    const dir = parts.length > 1 ? parts[parts.length - 2] : "(root)";
    byDir[dir] = (byDir[dir] || 0) + f.volatility;
  }

  const sorted = Object.entries(byDir).sort((a, b) => b[1] - a[1]);
  const top5   = sorted.slice(0, 5);
  const other  = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
  const labels = [...top5.map(([k]) => k), ...(other > 0 ? ["Other"] : [])];
  const data   = [...top5.map(([, v]) => v), ...(other > 0 ? [other] : [])];

  chartInstances.churnByDir = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: DONUT_PALETTE.slice(0, data.length),
        borderColor: "#1e1e1e",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          align: "center",
          labels: { color: "#e8e8e8", padding: 10, font: { size: 12 }, boxWidth: 12 },
        },
      },
    },
  });
}

/**
 * Render commits table with proportional churn bars
 */
function renderCommitsTable() {
  const tbody = document.getElementById("commitsTableBody");
  if (!tbody) return;

  const commits = (analyticsData.commits || []).slice(0, 50);
  const maxChurn = Math.max(...commits.map(c => c.insertions + c.deletions), 1);
  const MAX_BAR = 80; // px

  tbody.innerHTML = "";
  for (const c of commits) {
    const insW = Math.round((c.insertions / maxChurn) * MAX_BAR);
    const delW = Math.round((c.deletions  / maxChurn) * MAX_BAR);
    const row = tbody.insertRow();
    row.innerHTML = `
      <td><code class="hash">${escapeHtml(c.hash.slice(0, 7))}</code></td>
      <td>${escapeHtml(c.author)}</td>
      <td class="commit-msg">${escapeHtml(c.message.slice(0, 70))}</td>
      <td class="ins-count">+${c.insertions}</td>
      <td class="del-count">−${c.deletions}</td>
      <td>
        <div class="churn-bar">
          <div class="churn-ins" style="width:${insW}px"></div>
          <div class="churn-del" style="width:${delW}px"></div>
        </div>
      </td>
    `;
  }
}

/**
 * Render files table (top 50 by volatility)
 */
function renderFilesTable() {
  const tbody = document.getElementById("filesTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const files = analyticsData.files || [];
  for (let i = 0; i < Math.min(files.length, 50); i++) {
    const file = files[i];
    const row = tbody.insertRow();
    row.innerHTML = `
      <td><span class="path-link" data-path="${escapeHtml(file.path)}"><code>${escapeHtml(file.path)}</code></span></td>
      <td>${file.commitCount}</td>
      <td>+${file.insertions}</td>
      <td>-${file.deletions}</td>
      <td>${file.volatility.toFixed(1)}</td>
      <td><span class="risk-${file.risk}">${file.risk}</span></td>
    `;
  }
}

/**
 * Render both tables
 */
function renderTables() {
  renderCommitsTable();
  renderFilesTable();
}

/**
 * Event Listeners
 */

// Event delegation for click-to-open paths
document.addEventListener("click", (e) => {
  const link = e.target.closest(".path-link");
  if (link) vscode?.postMessage({ type: "openFile", payload: link.dataset.path });
});

// Right-click on a .path-link → small "Ignore file / Ignore folder" menu.
// Sends an "ignorePath" message; the extension appends to .meridian/.meridianignore,
// invalidates the analyzer cache, and re-renders the report.
installIgnoreContextMenu();

document.getElementById("applyFilters")?.addEventListener("click", () => {
  const period      = document.getElementById("period")?.value || "3mo";
  const author      = document.getElementById("authorFilter")?.value || "";
  const pathPattern = document.getElementById("pathFilter")?.value || "";

  if (vscode) {
    vscode.postMessage({
      type: "filter",
      payload: {
        period,
        author: author || undefined,
        pathPattern: pathPattern || undefined,
      },
    });
  }
});

document.getElementById("refreshBtn")?.addEventListener("click", postRefresh);

document.getElementById("exportJson")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "export", format: "json" });
});

document.getElementById("exportCsv")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "export", format: "csv" });
});

document.getElementById("exportAs")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "exportAs" });
});

/**
 * Helper: set text content of an element by id
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Right-click context menu for .path-link rows. Shared logic — kept inline
 * because the three Meridian webviews don't currently share a JS module.
 */
function installIgnoreContextMenu() {
  let activeMenu = null;
  function dismiss() {
    if (activeMenu && activeMenu.parentNode) {
      activeMenu.parentNode.removeChild(activeMenu);
    }
    activeMenu = null;
  }
  function build(rawPath, x, y) {
    dismiss();
    const menu = document.createElement("div");
    menu.className = "meridian-context-menu";
    menu.setAttribute("role", "menu");

    const header = document.createElement("div");
    header.className = "menu-header";
    header.textContent = rawPath;
    menu.appendChild(header);

    function addItem(label, kind) {
      const item = document.createElement("div");
      item.className = "menu-item";
      item.setAttribute("role", "menuitem");
      item.textContent = label;
      item.addEventListener("click", () => {
        vscode && vscode.postMessage({ type: "ignorePath", payload: { path: rawPath, kind: kind } });
        dismiss();
      });
      menu.appendChild(item);
    }
    addItem("Ignore file", "file");
    addItem("Ignore folder", "folder");

    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 4;
    const maxY = window.innerHeight - rect.height - 4;
    menu.style.left = Math.min(x, Math.max(0, maxX)) + "px";
    menu.style.top  = Math.min(y, Math.max(0, maxY)) + "px";
    activeMenu = menu;
  }

  document.addEventListener("contextmenu", (e) => {
    const link = e.target.closest && e.target.closest(".path-link");
    if (!link || !link.dataset || !link.dataset.path) return;
    e.preventDefault();
    build(link.dataset.path, e.clientX, e.clientY);
  });
  document.addEventListener("click", (e) => {
    if (activeMenu && !activeMenu.contains(e.target)) dismiss();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dismiss();
  });
  window.addEventListener("blur", dismiss);
  window.addEventListener("scroll", dismiss, true);
}

// Initialize on document load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (analyticsData) renderUI();
  });
} else {
  if (analyticsData) renderUI();
}
