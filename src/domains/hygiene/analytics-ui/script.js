/**
 * Hygiene Analytics Webview Script
 *
 * Message protocol:
 *   extension → webview:  { type: "init", payload: HygieneAnalyticsReport }
 *   webview → extension:  { type: "refresh" }
 */

const vscode = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

let report = null;
let charts = {};

// Category colour palette (matches CSS tokens)
const CAT_COLORS = {
  markdown: "#4fc3f7",
  source:   "#81c784",
  config:   "#ffb74d",
  log:      "#ff8a65",
  backup:   "#ce93d8",
  temp:     "#ef9a9a",
  artifact: "#f06292",
  other:    "#90a4ae",
};

// ============================================================================
// Message listener
// ============================================================================

if (vscode) {
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "loading") {
      document.body.classList.add("meridian-loading");
      return;
    }
    if (msg.type === "init") {
      document.body.classList.remove("meridian-loading");
      report = msg.payload;
      renderUI();
      return;
    }
    if (msg.type === "error") {
      document.body.classList.remove("meridian-loading");
    }
  });
}

// ============================================================================
// Top-level render
// ============================================================================

function renderUI() {
  if (!report) return;
  updateSummary();
  renderCategoryBar();
  renderLinesByCategory();
  renderCleanupChart();
  renderCollections();
  renderPruneTable();
  renderTopTalkers();
  renderDuplicates();
}

// ============================================================================
// Summary cards — Total Files | Prune Candidates | Dead Code | Disk Savings
// ============================================================================

function updateSummary() {
  const s  = report.summary;
  const dc = report.deadCode;

  setText("totalFiles",  s.totalFiles.toLocaleString());
  setText("pruneCount",  s.pruneCount.toLocaleString());
  setText("diskSavings", fmtBytes(s.pruneEstimateSizeBytes));

  if (dc) {
    const fileCount = countDeadCodeFiles(dc.items);
    setText("deadCodeCount", dc.items.length.toLocaleString());
    const fileSub = fileCount === 1 ? "1 file" : `${fileCount} files`;
    const tsconfigNote = dc.tsconfigPath ? "" : " · no tsconfig";
    setText("deadCodeSub", `across ${fileSub}${tsconfigNote}`);
  } else {
    setText("deadCodeCount", "—");
    setText("deadCodeSub",   "run a scan to populate");
  }

  // Prune sub — show size recoverable
  setText("pruneFilesSub", fmtBytes(s.pruneEstimateSizeBytes) + " recoverable");

  // Active prune criteria (for the prune table section)
  const pc    = report.pruneConfig;
  const parts = [
    `age ≥ ${pc.minAgeDays}d`,
    `size > ${pc.maxSizeMB} MB`,
    `categories: [${(pc.categories || []).join(", ")}]`,
  ];
  if (pc.minLineCount > 0) parts.push(`lines ≥ ${pc.minLineCount}`);
  setText("pruneCriteria", "Active criteria: " + parts.join(" · "));
}

function countDeadCodeFiles(items) {
  return new Set((items || []).map((i) => i.filePath)).size;
}

// ============================================================================
// Chart 1 — Category Distribution (thin full-width horizontal stacked bar)
// ============================================================================

function renderCategoryBar() {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;
  destroyChart("category");

  const byCategory = report.summary.byCategory || {};
  const categories = Object.keys(byCategory).filter((c) => byCategory[c].count > 0);
  if (categories.length === 0) return;

  const datasets = categories.map((cat) => ({
    label: cat,
    data: [byCategory[cat].count],
    backgroundColor: CAT_COLORS[cat] || "#90a4ae",
    borderWidth: 0,
  }));

  charts.category = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [""],
      datasets,
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const cat = categories[item.datasetIndex];
              const stats = byCategory[cat];
              return ` ${cat}: ${stats.count} files (${fmtBytes(stats.sizeBytes)})`;
            },
          },
        },
      },
      scales: {
        x: { stacked: true, display: false },
        y: { stacked: true, display: false },
      },
    },
  });

  // Build custom HTML legend
  const legendEl = document.getElementById("categoryLegend");
  if (legendEl) {
    legendEl.innerHTML = categories.map((cat) => `
      <span class="legend-item">
        <span class="legend-swatch" style="background:${CAT_COLORS[cat] || "#90a4ae"}"></span>
        <span>${cat} (${byCategory[cat].count})</span>
      </span>
    `).join("");
  }
}

// ============================================================================
// Chart 2 — Cleanup Activity: prune candidates + dead code issues, 14-day rolling
// ============================================================================

function renderCleanupChart() {
  const ctx = document.getElementById("temporalChart");
  if (!ctx) return;
  destroyChart("temporal");

  const td = report.temporalData;
  if (!td || !td.buckets || td.buckets.length === 0) return;

  // Trim leading days with zero activity; keep one buffer day for context.
  const firstActive = td.buckets.findIndex(
    (b) => b.pruneCount > 0 || (b.deadCodeCount || 0) > 0
  );
  const startIdx = firstActive > 0 ? Math.max(0, firstActive - 1) : 0;
  const buckets  = td.buckets.slice(startIdx);

  const labels        = buckets.map((b) => b.label);
  const pruneCounts   = buckets.map((b) => b.pruneCount || 0);
  const deadCounts    = buckets.map((b) => b.deadCodeCount || 0);

  const hasDeadData   = deadCounts.some((n) => n > 0);

  const datasets = [
    {
      label: "Prune candidates",
      data: pruneCounts,
      borderColor: "#ffaa00",
      backgroundColor: "rgba(255,170,0,0.08)",
      borderDash: [5, 4],
      tension: 0.3,
      fill: true,
      pointRadius: 3,
      borderWidth: 2,
    },
  ];

  if (hasDeadData) {
    datasets.push({
      label: "Dead code issues",
      data: deadCounts,
      borderColor: "#06b6d4",
      backgroundColor: "rgba(6,182,212,0.08)",
      tension: 0.3,
      fill: true,
      pointRadius: 3,
      borderWidth: 2,
    });
  }

  const yMax = Math.max(
    Math.ceil(Math.max(...pruneCounts, ...deadCounts, 1) * 1.2),
    10
  );

  charts.temporal = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      aspectRatio: 4,
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: "#d4d4d4",
            font: { size: 11 },
            padding: 12,
            boxWidth: 12,
          },
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      scales: {
        x: {
          grid:  { color: "rgba(255,255,255,0.07)" },
          ticks: { color: "#d4d4d4", font: { size: 10 }, maxRotation: 45 },
        },
        y: {
          beginAtZero: true,
          max: yMax,
          grid:  { color: "rgba(255,255,255,0.07)" },
          ticks: { color: "#d4d4d4", precision: 0 },
          title: { display: true, text: "Count", color: "#d4d4d4", font: { size: 11 } },
        },
      },
    },
  });
}

// ============================================================================
// Prune candidates table
// ============================================================================

function renderPruneTable() {
  const tbody = document.getElementById("pruneTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const candidates = report.pruneCandiates || [];
  if (candidates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:0.5;padding:12px">No prune candidates with active criteria</td></tr>`;
    return;
  }

  for (const f of candidates.slice(0, 100)) {
    const row = tbody.insertRow();
    row.className = "prune-row";
    row.innerHTML = `
      <td><span class="path-link" data-path="${esc(f.path)}"><code title="${esc(f.path)}">${esc(f.path)}</code></span></td>
      <td>${fmtBytes(f.sizeBytes)}</td>
      <td>${f.lineCount >= 0 ? f.lineCount.toLocaleString() : "—"}</td>
      <td>${f.ageDays}</td>
      <td><span class="cat-${f.category}">${f.category}</span></td>
    `;
  }
}

// ============================================================================
// Lines-by-category strip (raw line counts — not LOC)
// ============================================================================

function renderLinesByCategory() {
  const el = document.getElementById("linesStrip");
  if (!el) return;
  const lbc = report.linesByCategory || {};
  const entries = Object.entries(lbc)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    el.innerHTML = `<span class="lines-empty">no countable files</span>`;
    return;
  }

  el.innerHTML = entries.map(([cat, count]) => `
    <span class="lines-pill">
      <span class="legend-swatch" style="background:${CAT_COLORS[cat] || "#90a4ae"}"></span>
      <span class="lines-cat">${esc(cat)}</span>
      <span class="lines-count">${count.toLocaleString()}</span>
    </span>
  `).join("");
}

// ============================================================================
// Collections — heavy-artifact dir buckets
// ============================================================================

function renderCollections() {
  const c = report.collections || { envs: [], caches: [], buildOutputs: [], vendoredDeps: [] };
  renderCollectionBucket("envs", c.envs);
  renderCollectionBucket("caches", c.caches);
  renderCollectionBucket("buildOutputs", c.buildOutputs);
  renderCollectionBucket("vendoredDeps", c.vendoredDeps);
}

function renderCollectionBucket(key, paths) {
  setText(`${key}Count`, String(paths.length));
  const el = document.getElementById(`${key}Paths`);
  if (!el) return;
  if (paths.length === 0) {
    el.innerHTML = `<span class="collection-empty">none found</span>`;
    return;
  }
  el.innerHTML = paths.map((p) => `
    <span class="path-link" data-path="${esc(p)}"><code title="${esc(p)}">${esc(p)}</code></span>
  `).join("");
}

// ============================================================================
// Top talkers — Largest + Oldest (top 10 each)
// ============================================================================

function renderTopTalkers() {
  renderTopTable("largestTableBody", report.largestFiles || []);
  renderTopTable("oldestTableBody", report.oldestFiles || []);
}

function renderTopTable(bodyId, rows) {
  const tbody = document.getElementById(bodyId);
  if (!tbody) return;
  const slice = rows.slice(0, 10);
  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:0.5;padding:12px">No files</td></tr>`;
    return;
  }
  tbody.innerHTML = slice.map((f) => `
    <tr${f.isPruneCandidate ? ' class="prune-row"' : ""}>
      <td><span class="path-link" data-path="${esc(f.path)}"><code title="${esc(f.path)}">${esc(f.path)}</code></span></td>
      <td>${fmtBytes(f.sizeBytes)}</td>
      <td>${f.lineCount >= 0 ? f.lineCount.toLocaleString() : "—"}</td>
      <td>${f.ageDays}</td>
      <td><span class="cat-${f.category}">${esc(f.category)}</span></td>
    </tr>
  `).join("");
}

// ============================================================================
// Duplicate basenames
// ============================================================================

function renderDuplicates() {
  const tbody = document.getElementById("duplicatesTableBody");
  if (!tbody) return;
  const dupes = report.duplicateBasenames || [];
  if (dupes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;opacity:0.5;padding:12px">No duplicates (min 3 occurrences)</td></tr>`;
    return;
  }
  tbody.innerHTML = dupes.map((d) => `
    <tr>
      <td><code>${esc(d.basename)}</code></td>
      <td>${d.count}</td>
      <td>
        <div class="dup-paths">
          ${d.paths.map((p) => `<span class="path-link" data-path="${esc(p)}"><code title="${esc(p)}">${esc(p)}</code></span>`).join("")}
        </div>
      </td>
    </tr>
  `).join("");
}

// ============================================================================
// Event listeners
// ============================================================================

document.getElementById("refreshBtn")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "refresh" });
});

document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "export", format: "json" });
});

document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "export", format: "csv" });
});

document.getElementById("exportAsBtn")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "exportAs" });
});

// Event delegation for click-to-open paths
document.addEventListener("click", (e) => {
  const link = e.target.closest(".path-link");
  if (link) vscode?.postMessage({ type: "openFile", path: link.dataset.path });
});

// Right-click on a .path-link → "Ignore file / Ignore folder" menu.
// Sends an "ignorePath" message; extension appends to .meridian/.meridianignore,
// invalidates the HygieneAnalyzer cache, and re-renders the report.
installIgnoreContextMenu();

// ============================================================================
// Helpers
// ============================================================================

function fmtBytes(bytes) {
  if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(1) + " GB";
  if (bytes >= 1_048_576)     return (bytes / 1_048_576).toFixed(1) + " MB";
  if (bytes >= 1_024)          return (bytes / 1_024).toFixed(1) + " KB";
  return bytes + " B";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]
  ));
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
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

