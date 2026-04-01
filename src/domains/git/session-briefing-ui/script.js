// Session Briefing Webview Script
// Receives { type: "init", payload: SessionBriefingReport } from extension host.

(function () {
  // @ts-ignore — vscode is injected by the webview host
  const vscode = acquireVsCodeApi();

  var currentCommits = [];
  var currentSort = { col: null, asc: true };

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

  // ── Message handler ────────────────────────────────────────────────
  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (msg.type === "init" && msg.payload) {
      renderUI(msg.payload);
    }
  });

  // ── Render ─────────────────────────────────────────────────────────

  function renderUI(report) {
    renderBranchBar(report);
    renderSummaryCards(report);
    renderFlags(report.flags);
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
    return '<div class="card"><h3>' + esc(label) + '</h3><p class="value">' + value + '</p></div>';
  }

  function renderFlags(flags) {
    var el = document.getElementById("flagsSection");
    if (!flags || flags.length === 0) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = '<div class="flags-container">' +
      flags.map(function (f) {
        return '<div class="flag"><span class="flag-icon">&#9888;</span>' + esc(f) + '</div>';
      }).join("") +
      '</div>';
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
    var tbody = document.getElementById("uncommittedTableBody");
    var countEl = document.getElementById("uncommittedCount");
    var section = document.getElementById("uncommittedSection");

    if (!files || files.length === 0) {
      section.style.display = "none";
      return;
    }

    section.style.display = "";
    countEl.textContent = "(" + files.length + " file" + (files.length === 1 ? "" : "s") + ")";

    tbody.innerHTML = files.map(function (f) {
      return '<tr>' +
        '<td><span class="status-badge status-' + f.status + '">' + f.status + '</span></td>' +
        '<td class="path-link" data-path="' + esc(f.path) + '">' + esc(f.path) + '</td>' +
        '</tr>';
    }).join("");
  }

  function renderSummary(summary) {
    var el = document.getElementById("summaryContent");
    el.textContent = summary || "No summary available.";
  }

  // ── Click-to-open ──────────────────────────────────────────────────
  document.addEventListener("click", function (e) {
    var link = e.target.closest(".path-link");
    if (link && link.dataset.path) {
      vscode.postMessage({ type: "openFile", payload: link.dataset.path });
    }
  });

  // ── Util ───────────────────────────────────────────────────────────
  function esc(str) {
    if (str == null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
