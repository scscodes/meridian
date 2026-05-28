// Session Briefing Webview Script
// Receives { type: "init", payload: SessionBriefingReport } from extension host.

(function () {
  // @ts-ignore — vscode is injected by the webview host
  const vscode = acquireVsCodeApi();

  var currentCommits = [];
  var currentSort = { col: null, asc: true };
  // Source arrays for the three client-side-filterable tables. Re-assigned on
  // each render; read by the .path-filter input handler at every keystroke.
  var currentChurn = [];
  var currentPending = null; // PendingChangeRisk | null (need capped/counts on redraw)
  var currentUncommitted = [];

  function applyPathFilter(items, query) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(function (it) {
      return (it.path || "").toLowerCase().indexOf(q) !== -1;
    });
  }

  // ── Buttons ────────────────────────────────────────────────────────
  document.getElementById("refreshBtn").addEventListener("click", function () {
    vscode.postMessage({ type: "refresh" });
  });
  document.getElementById("exportCsv").addEventListener("click", function () {
    vscode.postMessage({ type: "export", format: "csv" });
  });
  document.getElementById("exportJson").addEventListener("click", function () {
    vscode.postMessage({ type: "export", format: "json" });
  });
  document.getElementById("exportAs").addEventListener("click", function () {
    vscode.postMessage({ type: "exportAs" });
  });

  // ── Client-side path filters ───────────────────────────────────────
  // Pure DOM, no host round-trip. Re-reads currentChurn / currentPending /
  // currentUncommitted on each keystroke; survives renderUI re-renders
  // because input values live in the DOM and source arrays are kept in
  // module-level state.
  var FILTER_REDRAW = {
    churn: function () { redrawChurn(); },
    pending: function () { redrawPending(); },
    uncommitted: function () { redrawUncommitted(); },
  };
  document.addEventListener("input", function (e) {
    var input = e.target.closest && e.target.closest(".path-filter");
    if (!input) return;
    var redraw = FILTER_REDRAW[input.dataset.target];
    if (redraw) redraw();
  });

  // ── Message handler ────────────────────────────────────────────────
  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (msg.type === "loading") {
      document.body.classList.add("meridian-loading");
      return;
    }
    if (msg.type === "init" && msg.payload) {
      document.body.classList.remove("meridian-loading");
      renderUI(msg.payload);
      return;
    }
    if (msg.type === "error") {
      document.body.classList.remove("meridian-loading");
    }
  });

  // ── Render ─────────────────────────────────────────────────────────

  function renderUI(report) {
    renderBranchBar(report);
    renderSummaryCards(report);
    renderFlags(report.flags);
    renderActivity(report.activityWindow);
    renderHygiene(report.hygieneSnapshot);
    renderRecentRuns(report.recentRuns);
    renderPendingRisk(report.pendingChangeRisk);
    currentCommits = report.recentCommits || [];
    currentSort = { col: null, asc: true };
    renderCommitsTable(currentCommits);
    renderUncommitted(report.uncommittedFiles);
    renderSummary(report.summary);
  }

  function renderBranchBar(r) {
    var el = document.getElementById("branchBar");
    var badgeClass = r.isDirty ? "badge-dirty" : "badge-clean";
    var badgeText = r.isDirty ? "dirty" : "clean";
    var ts = r.generatedAt ? new Date(r.generatedAt).toLocaleTimeString() : "";
    el.innerHTML =
      '<span class="branch-name">' + esc(r.branch) + '</span>' +
      '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
      '<span class="timestamp">' + esc(ts) + '</span>';
  }

  function renderSummaryCards(r) {
    var el = document.getElementById("summaryCards");
    el.innerHTML =
      card("Staged", r.staged) +
      card("Unstaged", r.unstaged) +
      card("Untracked", r.untracked);
  }

  function card(label, value) {
    // All three summary cards open the Source Control view (single VS Code
    // built-in command, no payload; handled host-side as type:"openScm").
    return '<div class="card card-clickable" data-action="openScm" title="Open Source Control">' +
      '<h3>' + esc(label) + '</h3><p class="value">' + value + '</p></div>';
  }

  // Map known flag prefixes to a section anchor for scroll-to. Flag strings
  // live in session-aggregator.ts; if they change here without an update there
  // the flag degrades to inert (no scroll, no error) — acceptable.
  var FLAG_ANCHORS = [
    { re: /^Recent run failures/i,             anchor: "recentRunsSection" },
    { re: /^Modifying \d+ high-risk files/i,   anchor: "pendingRiskSection" },
    { re: /^Hygiene: \d+ dead files/i,         anchor: "hygieneSection" },
    { re: /^Hygiene: \d+ large files/i,        anchor: "hygieneSection" },
    { re: /^Large number of uncommitted files/i, anchor: "uncommittedSection" },
  ];

  function flagAnchorFor(text) {
    for (var i = 0; i < FLAG_ANCHORS.length; i++) {
      if (FLAG_ANCHORS[i].re.test(text)) return FLAG_ANCHORS[i].anchor;
    }
    return null;
  }

  function renderFlags(flags) {
    var el = document.getElementById("flagsSection");
    if (!flags || flags.length === 0) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = '<div class="flags-container">' +
      flags.map(function (f) {
        // Special-case: replace the "No hygiene scan yet" warning with an
        // inline CTA — the flag is the affordance.
        if (f === "No hygiene scan yet") {
          return '<div class="flag">' +
            '<span class="flag-icon">&#9888;</span>' +
            'No hygiene scan yet &nbsp;' +
            '<button class="flag-cta" data-action="runHygieneScan">Run scan</button>' +
            '</div>';
        }
        var anchor = flagAnchorFor(f);
        var attrs = anchor
          ? ' data-anchor="' + esc(anchor) + '" title="Jump to section"'
          : '';
        var cls = anchor ? 'flag flag-clickable' : 'flag';
        return '<div class="' + cls + '"' + attrs + '>' +
          '<span class="flag-icon">&#9888;</span>' + esc(f) + '</div>';
      }).join("") +
      '</div>';
  }

  // ── Activity & Hygiene (retained computed insight) ─────────────────

  function metricCard(label, value) {
    return '<div class="card"><h3>' + esc(label) + '</h3>' +
      '<p class="value">' + esc(value) + '</p></div>';
  }

  function trendLabel(d) {
    if (d === "up") return "▲ up";
    if (d === "down") return "▼ down";
    return "▬ stable";
  }

  // Inline-SVG sparkline of the commit-frequency series — the shape behind the
  // trend arrow. No Chart.js dependency (this webview ships none). Returns ""
  // for degenerate input (missing, <2 points, or all-zero) so the caller can
  // hide the block, mirroring the topChurnFiles empty-guard.
  function sparklineSvg(series) {
    var data = Array.isArray(series) ? series.map(Number).filter(function (n) {
      return isFinite(n);
    }) : [];
    if (data.length < 2) return "";
    var max = Math.max.apply(null, data);
    var min = Math.min.apply(null, data);
    if (max <= 0) return "";

    var W = 240, H = 44, padY = H * 0.12;
    var span = max - min;
    var pts = data.map(function (v, i) {
      var x = (i / (data.length - 1)) * W;
      var y = span === 0
        ? H / 2
        : H - padY - ((v - min) / span) * (H - 2 * padY);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    var d = "M" + pts.join(" L");

    return '<svg class="sparkline" viewBox="0 0 ' + W + ' ' + H +
      '" preserveAspectRatio="none" role="img" aria-label="Commit frequency trend">' +
      '<path d="' + d + '" fill="none" stroke="#06b6d4" stroke-width="1.5" ' +
      'vector-effect="non-scaling-stroke" stroke-linejoin="round" ' +
      'stroke-linecap="round" /></svg>';
  }

  function renderActivity(w) {
    var section = document.getElementById("activitySection");
    if (!w) {
      section.style.display = "none";
      currentChurn = [];
      return;
    }
    section.style.display = "";
    document.getElementById("activityPeriod").textContent = "(" + esc(w.period) + ")";

    var cards = [
      metricCard("Commits", w.commitsInWindow),
      metricCard("Files Touched", w.filesTouched),
    ];
    if (w.trends) {
      cards.push(
        metricCard(
          "Commit Trend",
          trendLabel(w.trends.commitDirection) +
            " · " + Math.round(w.trends.commitConfidence * 100) + "%"
        )
      );
      cards.push(metricCard("Volatility", trendLabel(w.trends.volatilityDirection)));
    }
    document.getElementById("activityMetrics").innerHTML = cards.join("");

    var sb = document.getElementById("sparklineBlock");
    var spark = sparklineSvg(w.commitFrequency && w.commitFrequency.data);
    sb.innerHTML = spark
      ? '<h3 class="sub">Commit Frequency</h3>' + spark
      : "";

    currentChurn = w.topChurnFiles || [];
    var cb = document.getElementById("churnBlock");
    var filterRow = document.getElementById("churnFilterRow");
    if (currentChurn.length === 0) {
      cb.innerHTML = "";
      if (filterRow) filterRow.style.display = "none";
      return;
    }
    if (filterRow) filterRow.style.display = "";
    cb.innerHTML =
      '<h3 class="sub">Top Churn Files</h3>' +
      '<table><thead><tr><th>Path</th><th>Volatility</th><th>Risk</th></tr></thead>' +
      '<tbody id="churnTableBody"></tbody></table>';
    redrawChurn();
  }

  function churnRow(f) {
    return '<tr>' +
      '<td class="path-link" data-path="' + esc(f.path) + '">' + esc(f.path) + '</td>' +
      '<td>' + Number(f.volatility).toFixed(1) + '</td>' +
      '<td><span class="risk risk-' + esc(f.risk) + ' report-link" data-report="gitAnalytics" title="Open in Git Analytics">' + esc(f.risk) + '</span></td>' +
      '</tr>';
  }

  function redrawChurn() {
    var tbody = document.getElementById("churnTableBody");
    if (!tbody) return;
    var input = document.querySelector('.path-filter[data-target="churn"]');
    var rows = applyPathFilter(currentChurn, input && input.value);
    tbody.innerHTML = rows.length
      ? rows.map(churnRow).join("")
      : '<tr><td colspan="3" style="opacity:0.4">No matches</td></tr>';
  }

  function renderHygiene(h) {
    var section = document.getElementById("hygieneSection");
    if (!h) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    document.getElementById("hygieneScannedAt").textContent = h.scannedAt
      ? "(scanned " + new Date(h.scannedAt).toLocaleString() + ")"
      : "";

    document.getElementById("hygieneMetrics").innerHTML = [
      metricCard("Dead Files", h.deadFileCount),
      metricCard("Large Files", h.largeFileCount),
      metricCard("Log Files", h.logFileCount),
      metricCard("Dead Code", h.deadCodeItemCount),
    ].join("");

    var sample = h.deadCodeSample || [];
    var db = document.getElementById("deadCodeBlock");
    if (sample.length === 0) {
      db.innerHTML = "";
      return;
    }
    db.innerHTML =
      '<h3 class="sub">Dead Code Sample</h3>' +
      '<table><thead><tr><th>File</th><th>Line</th><th>Message</th><th></th></tr></thead><tbody>' +
      sample.map(function (d) {
        return '<tr>' +
          '<td class="path-link" data-path="' + esc(d.filePath) + '">' + esc(d.filePath) + '</td>' +
          '<td>' + Number(d.line) + '</td>' +
          '<td class="commit-msg">' + esc(d.message) + '</td>' +
          '<td><span class="report-link adornment" data-report="hygiene" title="Open in Hygiene Analytics">&#8599;</span></td>' +
          '</tr>';
      }).join("") +
      '</tbody></table>';
  }

  // ── Recent runs (run-log terminal events) ──────────────────────────

  function renderRecentRuns(runs) {
    var section = document.getElementById("recentRunsSection");
    if (!runs || runs.length === 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";

    var failCount = 0;
    for (var i = 0; i < runs.length; i++) {
      if (runs[i].phase === "fail") failCount++;
    }
    document.getElementById("recentRunsHint").textContent =
      "(last " + runs.length + (failCount > 0 ? " · " + failCount + " failed" : "") + ")";

    document.getElementById("recentRunsTableBody").innerHTML = runs.map(function (r) {
      var time = r.timestampMs ? new Date(r.timestampMs).toLocaleTimeString() : "—";
      // commandName is the live identifier post-2.0; workflowName / skillName
      // are inert per ADR 011 but tolerated as fallbacks for older log entries.
      var name = r.commandName || r.workflowName || r.skillName || "—";
      var dur = r.durationMs != null ? r.durationMs + "ms" : "—";
      var err = r.errorCode || "";
      return '<tr>' +
        '<td>' + esc(time) + '</td>' +
        '<td>' + esc(name) + '</td>' +
        '<td><span class="phase-badge phase-' + esc(r.phase) + '">' + esc(r.phase) + '</span></td>' +
        '<td>' + esc(dur) + '</td>' +
        '<td class="commit-msg">' + esc(err) + '</td>' +
        '</tr>';
    }).join("");
  }

  // ── Pending-change risk (dirty-set × analytics risk join) ──────────

  function renderPendingRisk(p) {
    var section = document.getElementById("pendingRiskSection");
    if (!p || !p.files || p.files.length === 0) {
      section.style.display = "none";
      currentPending = null;
      return;
    }
    section.style.display = "";
    currentPending = p;
    document.getElementById("pendingRiskHint").textContent =
      "(" + p.totalChanged + " changed" +
      (p.capped ? ", showing top " + p.files.length : "") + ")";

    document.getElementById("pendingRiskMetrics").innerHTML = [
      metricCard("Changed", p.totalChanged),
      metricCard("High-Risk", p.hotspotCount),
    ].join("");

    document.getElementById("pendingRiskBlock").innerHTML =
      '<table><thead><tr><th>Path</th><th>Status</th><th>Churn</th>' +
      '<th>Volatility</th><th>Risk</th><th></th></tr></thead>' +
      '<tbody id="pendingRiskTableBody"></tbody></table>';
    redrawPending();
  }

  function pendingRow(f) {
    return '<tr>' +
      '<td class="path-link" data-path="' + esc(f.path) + '">' + esc(f.path) + '</td>' +
      '<td>' + esc(f.status) + '</td>' +
      '<td>' + (f.churn == null ? '&mdash;' : Number(f.churn)) + '</td>' +
      '<td>' + (f.volatility == null ? '&mdash;' : Number(f.volatility).toFixed(1)) + '</td>' +
      '<td><span class="risk risk-' + esc(f.risk) + ' report-link" data-report="gitAnalytics" title="Open in Git Analytics">' + esc(f.risk) + '</span></td>' +
      '<td><span class="diff-link" data-path="' + esc(f.path) + '" title="Open diff against HEAD">&#8646;</span></td>' +
      '</tr>';
  }

  function redrawPending() {
    var tbody = document.getElementById("pendingRiskTableBody");
    if (!tbody || !currentPending) return;
    var input = document.querySelector('.path-filter[data-target="pending"]');
    var rows = applyPathFilter(currentPending.files, input && input.value);
    tbody.innerHTML = rows.length
      ? rows.map(pendingRow).join("")
      : '<tr><td colspan="6" style="opacity:0.4">No matches</td></tr>';
  }

  // ── Sortable commits table ─────────────────────────────────────────

  function renderCommitsTable(commits) {
    var tbody = document.getElementById("commitsTableBody");
    if (!commits || commits.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="opacity:0.4">No recent commits</td></tr>';
      return;
    }
    tbody.innerHTML = commits.map(function (c) {
      return '<tr>' +
        '<td><span class="hash">' + esc(c.shortHash) + '</span></td>' +
        '<td>' + esc(c.author) + '</td>' +
        '<td class="commit-msg">' + esc(c.message) + '</td>' +
        '<td class="ins-count">+' + c.insertions + '</td>' +
        '<td class="del-count">-' + c.deletions + '</td>' +
        '</tr>';
    }).join("");
    updateSortIndicators();
  }

  function sortCommits(col) {
    if (currentSort.col === col) {
      currentSort.asc = !currentSort.asc;
    } else {
      currentSort.col = col;
      currentSort.asc = true;
    }
    var sorted = currentCommits.slice().sort(function (a, b) {
      var av = a[col], bv = b[col];
      if (typeof av === "string") {
        av = av.toLowerCase();
        bv = (bv || "").toLowerCase();
      }
      if (av < bv) return currentSort.asc ? -1 : 1;
      if (av > bv) return currentSort.asc ? 1 : -1;
      return 0;
    });
    renderCommitsTable(sorted);
  }

  function updateSortIndicators() {
    var headers = document.querySelectorAll("#commitsTable th[data-col]");
    for (var i = 0; i < headers.length; i++) {
      var th = headers[i];
      var arrow = th.querySelector(".sort-arrow");
      if (th.dataset.col === currentSort.col) {
        arrow.textContent = currentSort.asc ? " \u25B2" : " \u25BC";
      } else {
        arrow.textContent = " \u25B4";
      }
    }
  }

  document.getElementById("commitsTable").addEventListener("click", function (e) {
    var th = e.target.closest("th[data-col]");
    if (th) sortCommits(th.dataset.col);
  });

  // ── Uncommitted files ──────────────────────────────────────────────

  function renderUncommitted(files) {
    var countEl = document.getElementById("uncommittedCount");
    var section = document.getElementById("uncommittedSection");

    if (!files || files.length === 0) {
      section.style.display = "none";
      currentUncommitted = [];
      return;
    }

    section.style.display = "";
    currentUncommitted = files;
    countEl.textContent = "(" + files.length + " file" + (files.length === 1 ? "" : "s") + ")";
    redrawUncommitted();
  }

  function uncommittedRow(f) {
    var s = esc(f.status);
    return '<tr>' +
      '<td><span class="status-badge status-' + s + '">' + s + '</span></td>' +
      '<td class="path-link" data-path="' + esc(f.path) + '">' + esc(f.path) + '</td>' +
      '</tr>';
  }

  function redrawUncommitted() {
    var tbody = document.getElementById("uncommittedTableBody");
    if (!tbody) return;
    var input = document.querySelector('.path-filter[data-target="uncommitted"]');
    var rows = applyPathFilter(currentUncommitted, input && input.value);
    tbody.innerHTML = rows.length
      ? rows.map(uncommittedRow).join("")
      : '<tr><td colspan="2" style="opacity:0.4">No matches</td></tr>';
  }

  function renderSummary(summary) {
    var el = document.getElementById("summaryContent");
    el.textContent = summary || "No summary available.";
  }

  // ── Click-to-open ──────────────────────────────────────────────────
  // Single delegated dispatcher with explicit precedence. Two document-level
  // listeners can't gate each other via stopPropagation (it stops bubbling,
  // not sibling document delegates) — collapsing into one handler makes the
  // precedence the only authority.
  //
  // Precedence (first match wins):
  //   1. .diff-link          → openDiff   (pending-change diff icon)
  //   2. .flag-cta           → runHygieneScan ("Run scan" inline CTA)
  //   3. .report-link        → openReport (risk badges, dead-code adornment)
  //   4. .card-clickable     → openScm    (summary cards)
  //   5. .flag-clickable     → scroll-to  (flag → known section anchor)
  //   6. .path-link          → openFile   (fallback)
  document.addEventListener("click", function (e) {
    if (!e.target || !e.target.closest) return;

    var diff = e.target.closest(".diff-link");
    if (diff && diff.dataset.path) {
      vscode.postMessage({ type: "openDiff", payload: diff.dataset.path });
      return;
    }

    var cta = e.target.closest(".flag-cta");
    if (cta && cta.dataset.action === "runHygieneScan") {
      vscode.postMessage({ type: "runHygieneScan" });
      return;
    }

    var rl = e.target.closest(".report-link");
    if (rl && rl.dataset.report) {
      vscode.postMessage({ type: "openReport", payload: { id: rl.dataset.report } });
      return;
    }

    var c = e.target.closest(".card-clickable");
    if (c && c.dataset.action === "openScm") {
      vscode.postMessage({ type: "openScm" });
      return;
    }

    var fl = e.target.closest(".flag-clickable");
    if (fl && fl.dataset.anchor) {
      var target = document.getElementById(fl.dataset.anchor);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    var link = e.target.closest(".path-link");
    if (link && link.dataset.path) {
      vscode.postMessage({ type: "openFile", payload: link.dataset.path });
    }
  });

  // ── Right-click ignore menu ────────────────────────────────────────
  // Sends an "ignorePath" message; the extension appends to .meridian/.meridianignore
  // and invalidates both analyzer caches (briefing pulls from git +
  // hygiene) so the next refresh reflects the change for analytics-derived
  // rows (topChurnFiles, pendingChangeRisk's joined entries).
  (function installIgnoreContextMenu() {
    var activeMenu = null;
    function dismiss() {
      if (activeMenu && activeMenu.parentNode) {
        activeMenu.parentNode.removeChild(activeMenu);
      }
      activeMenu = null;
    }
    function build(rawPath, x, y) {
      dismiss();
      var menu = document.createElement("div");
      menu.className = "meridian-context-menu";
      menu.setAttribute("role", "menu");

      var header = document.createElement("div");
      header.className = "menu-header";
      header.textContent = rawPath;
      menu.appendChild(header);

      function addItem(label, kind) {
        var item = document.createElement("div");
        item.className = "menu-item";
        item.setAttribute("role", "menuitem");
        item.textContent = label;
        item.addEventListener("click", function () {
          vscode.postMessage({ type: "ignorePath", payload: { path: rawPath, kind: kind } });
          dismiss();
        });
        menu.appendChild(item);
      }
      addItem("Ignore file", "file");
      addItem("Ignore folder", "folder");

      document.body.appendChild(menu);
      var rect = menu.getBoundingClientRect();
      var maxX = window.innerWidth - rect.width - 4;
      var maxY = window.innerHeight - rect.height - 4;
      menu.style.left = Math.min(x, Math.max(0, maxX)) + "px";
      menu.style.top  = Math.min(y, Math.max(0, maxY)) + "px";
      activeMenu = menu;
    }

    document.addEventListener("contextmenu", function (e) {
      var link = e.target.closest && e.target.closest(".path-link");
      if (!link || !link.dataset || !link.dataset.path) return;
      e.preventDefault();
      build(link.dataset.path, e.clientX, e.clientY);
    });
    document.addEventListener("click", function (e) {
      if (activeMenu && !activeMenu.contains(e.target)) dismiss();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") dismiss();
    });
    window.addEventListener("blur", dismiss);
    window.addEventListener("scroll", dismiss, true);
  })();

  // ── Util ───────────────────────────────────────────────────────────
  function esc(str) {
    if (str == null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
