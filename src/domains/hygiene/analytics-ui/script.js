/**
 * Hygiene Analytics Webview Script
 *
 * Message protocol:
 *   extension → webview:  { type: "init", payload: HygieneAnalyticsReport }
 *   webview → extension:  { type: "refresh" }
 *                         { type: "openSettings" }
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
    if (event.data.type === "init") {
      report = event.data.payload;
      renderUI();
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
  renderCleanupChart();
  renderPruneTable();
  renderFilesTable();
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
// All Files table — sortable, first 100
// ============================================================================

let sortCol = "sizeBytes";
let sortAsc  = false;

function renderFilesTable() {
  const tbody = document.getElementById("filesTableBody");
  if (!tbody) return;

  document.querySelectorAll("#filesTable th[data-col]").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.col === sortCol) {
      th.classList.add(sortAsc ? "sort-asc" : "sort-desc");
    }
  });

  const files = [...(report.files || [])].slice(0, 100);

  files.sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (typeof av === "string")  return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === "boolean") return sortAsc ? (av ? 1 : -1) : (av ? -1 : 1);
    const na = av === -1 ? 0 : av;
    const nb = bv === -1 ? 0 : bv;
    return sortAsc ? na - nb : nb - na;
  });

  tbody.innerHTML = "";

  for (const f of files) {
    const row = tbody.insertRow();
    if (f.isPruneCandidate) row.className = "prune-row";
    row.innerHTML = `
      <td><span class="path-link" data-path="${esc(f.path)}"><code title="${esc(f.path)}">${esc(f.path)}</code></span></td>
      <td>${fmtBytes(f.sizeBytes)}</td>
      <td>${f.lineCount >= 0 ? f.lineCount.toLocaleString() : "—"}</td>
      <td>${f.ageDays}</td>
      <td><span class="cat-${f.category}">${f.category}</span></td>
      <td>${f.isPruneCandidate ? '<span class="prune-yes">Yes</span>' : '<span class="prune-no">—</span>'}</td>
    `;
  }
}

// ============================================================================
// Event listeners
// ============================================================================

document.getElementById("refreshBtn")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "refresh" });
});

document.getElementById("settingsBtn")?.addEventListener("click", () => {
  vscode?.postMessage({ type: "openSettings" });
});

document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
  if (report) download("hygiene-analytics.json", JSON.stringify(report, null, 2), "application/json");
});

document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
  if (report) download("hygiene-analytics.csv", buildHygieneCsv(report.files), "text/csv");
});

// Event delegation for click-to-open paths
document.addEventListener("click", (e) => {
  const link = e.target.closest(".path-link");
  if (link) vscode?.postMessage({ type: "openFile", path: link.dataset.path });
});

document.querySelectorAll("#filesTable th[data-col]").forEach((th) => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    if (sortCol === col) {
      sortAsc = !sortAsc;
    } else {
      sortCol = col;
      sortAsc = col === "path" || col === "category";
    }
    if (report) renderFilesTable();
  });
});

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

function download(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildHygieneCsv(files) {
  const header = "path,size_bytes,line_count,age_days,category,prune_candidate";
  const rows = (files || []).map((f) =>
    [f.path, f.sizeBytes, f.lineCount, f.ageDays, f.category, f.isPruneCandidate]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...rows].join("\r\n");
}
