import { CONFIG } from "./config.js";

const state = {
  tabId: null,
  pageTitle: "export",
  items: [],
  selectedIndex: 0,
  isPro: false
};

const els = {
  statusBar: document.getElementById("statusBar"),
  controlsSection: document.getElementById("controlsSection"),
  emptySection: document.getElementById("emptySection"),
  targetSelect: document.getElementById("targetSelect"),
  metaStats: document.getElementById("metaStats"),
  previewTable: document.getElementById("previewTable"),
  copyMdBtn: document.getElementById("copyMdBtn"),
  downloadCsvBtn: document.getElementById("downloadCsvBtn"),
  downloadJsonBtn: document.getElementById("downloadJsonBtn"),
  exportAllBtn: document.getElementById("exportAllBtn"),
  cleanNumbersChk: document.getElementById("cleanNumbersChk"),
  rescanBtn: document.getElementById("rescanBtn"),
  proBadgeBtn: document.getElementById("proBadgeBtn"),
  licenseModal: document.getElementById("licenseModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  licenseInput: document.getElementById("licenseInput"),
  activateBtn: document.getElementById("activateBtn"),
  licenseMsg: document.getElementById("licenseMsg"),
  buyProLink: document.getElementById("buyProLink")
};

function setStatus(text, isError = false) {
  els.statusBar.textContent = text;
  els.statusBar.style.color = isError ? "#f87171" : "#94a3b8";
}

function updateProUI() {
  if (state.isPro) {
    els.proBadgeBtn.textContent = "PRO";
    els.proBadgeBtn.className = "badge badge-pro";
    els.proBadgeBtn.title = "TableSnap Pro Active";
  } else {
    els.proBadgeBtn.textContent = "FREE";
    els.proBadgeBtn.className = "badge badge-free";
    els.proBadgeBtn.title = "Activate Pro License";
  }
}

async function loadLicenseState() {
  const data = await chrome.storage.local.get(["proActive", "licenseKey"]);
  state.isPro = Boolean(data.proActive);
  if (data.licenseKey) {
    els.licenseInput.value = data.licenseKey;
  }
  updateProUI();
}

function openLicenseModal(message = "") {
  els.licenseMsg.textContent = message;
  els.licenseModal.classList.remove("hidden");
}

function closeLicenseModal() {
  els.licenseModal.classList.add("hidden");
}

async function verifyLicenseKey(key) {
  const trimmed = key.trim();
  if (!trimmed) {
    els.licenseMsg.textContent = "Please enter a license key.";
    return;
  }

  if (CONFIG.ALLOW_DEV_TEST_KEY && trimmed === CONFIG.DEV_TEST_KEY) {
    await chrome.storage.local.set({ proActive: true, licenseKey: trimmed });
    state.isPro = true;
    updateProUI();
    closeLicenseModal();
    setStatus("Pro activated (Dev Test Mode).");
    return;
  }

  if (CONFIG.GUMROAD_PRODUCT_ID === "REPLACE_WITH_YOUR_GUMROAD_PRODUCT_ID") {
    els.licenseMsg.textContent = "Set GUMROAD_PRODUCT_ID in src/config.js before live verification.";
    return;
  }

  els.activateBtn.disabled = true;
  els.licenseMsg.textContent = "Verifying with Gumroad...";

  try {
    const body = new URLSearchParams({
      product_id: CONFIG.GUMROAD_PRODUCT_ID,
      license_key: trimmed,
      increment_uses_count: "true"
    });

    const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const json = await res.json();

    if (json.success && !json.purchase?.refunded && !json.purchase?.chargebacked) {
      await chrome.storage.local.set({ proActive: true, licenseKey: trimmed });
      state.isPro = true;
      updateProUI();
      closeLicenseModal();
      setStatus("TableSnap Pro unlocked!");
    } else {
      els.licenseMsg.textContent = json.message || "Invalid or refunded license key.";
    }
  } catch (err) {
    els.licenseMsg.textContent = `Verification failed: ${err.message}`;
  } finally {
    els.activateBtn.disabled = false;
  }
}

function sanitizeCell(val, cleanNumbers) {
  if (!cleanNumbers) return val;
  // Strip common currency symbols and surrounding whitespace if cell looks numeric
  const stripped = val.replace(/[$€£¥,]/g, "").trim();
  if (/^-?\d+(\.\d+)?%?$/.test(stripped)) {
    return stripped;
  }
  return val;
}

function getProcessedRows(item) {
  const cleanNumbers = state.isPro && els.cleanNumbersChk.checked;
  return item.rows.map((row, rIdx) =>
    rIdx === 0 ? row : row.map((cell) => sanitizeCell(cell, cleanNumbers))
  );
}

function toCSV(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\r\n");
}

function toMarkdown(rows) {
  if (!rows.length) return "";
  const escapeMd = (s) => String(s ?? "").replace(/\|/g, "\\|");
  const header = `| ${rows[0].map(escapeMd).join(" | ")} |`;
  const sep = `| ${rows[0].map(() => "---").join(" | ")} |`;
  const body = rows
    .slice(1)
    .map((r) => `| ${r.map(escapeMd).join(" | ")} |`)
    .join("\n");
  return [header, sep, body].filter(Boolean).join("\n");
}

function toJSONObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h, i) => h || `col_${i + 1}`);
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(text) {
  return (text || "tablesnap")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "tablesnap";
}

function renderPreview(item) {
  const rows = getProcessedRows(item);
  els.metaStats.textContent = `${item.rowCount} rows × ${item.colCount} cols`;
  els.previewTable.innerHTML = "";

  const previewRows = rows.slice(0, 6);
  previewRows.forEach((row, rIdx) => {
    const tr = document.createElement("tr");
    row.slice(0, 6).forEach((cell) => {
      const el = document.createElement(rIdx === 0 ? "th" : "td");
      el.textContent = cell;
      el.title = cell;
      tr.appendChild(el);
    });
    els.previewTable.appendChild(tr);
  });
}

async function highlightSelected() {
  const item = state.items[state.selectedIndex];
  if (!item || !state.tabId) return;
  try {
    await chrome.tabs.sendMessage(state.tabId, {
      type: "TABLESNAP_HIGHLIGHT",
      id: item.id
    });
  } catch {
    // Ignore if tab navigated away
  }
}

function renderItems() {
  if (!state.items.length) {
    els.controlsSection.classList.add("hidden");
    els.emptySection.classList.remove("hidden");
    setStatus("No tables or repeating lists found.");
    return;
  }

  els.emptySection.classList.add("hidden");
  els.controlsSection.classList.remove("hidden");

  els.targetSelect.innerHTML = "";
  state.items.forEach((item, idx) => {
    const opt = document.createElement("option");
    const tag = item.kind === "list" ? "[Pro List]" : "[Table]";
    opt.value = String(idx);
    opt.textContent = `${tag} ${item.label} (${item.rowCount}×${item.colCount})`;
    els.targetSelect.appendChild(opt);
  });

  state.selectedIndex = 0;
  renderPreview(state.items[0]);
  highlightSelected();
  setStatus(`Found ${state.items.length} extractable dataset(s).`);
}

async function scanActiveTab() {
  setStatus("Scanning current page...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || /^(chrome|edge|about):/i.test(tab.url)) {
      els.controlsSection.classList.add("hidden");
      els.emptySection.classList.remove("hidden");
      setStatus("Cannot scan browser internal pages.", true);
      return;
    }

    state.tabId = tab.id;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });

    const response = await chrome.tabs.sendMessage(tab.id, { type: "TABLESNAP_SCAN" });
    state.items = response?.items || [];
    state.pageTitle = slugify(response?.title);
    renderItems();
  } catch (err) {
    els.controlsSection.classList.add("hidden");
    els.emptySection.classList.remove("hidden");
    setStatus(`Scan error: ${err.message}`, true);
  }
}

function requirePro(item) {
  if (state.isPro) return true;
  const reason =
    item?.kind === "list"
      ? "Smart List extraction is a Pro feature."
      : "Unlock Pro to use JSON export, batch export, and symbol cleaning.";
  openLicenseModal(reason);
  return false;
}

function bindEvents() {
  els.buyProLink.href = CONFIG.GUMROAD_PRODUCT_URL;

  els.targetSelect.addEventListener("change", () => {
    state.selectedIndex = parseInt(els.targetSelect.value, 10) || 0;
    renderPreview(state.items[state.selectedIndex]);
    highlightSelected();
  });

  els.cleanNumbersChk.addEventListener("change", () => {
    if (!state.isPro && els.cleanNumbersChk.checked) {
      els.cleanNumbersChk.checked = false;
      openLicenseModal("Symbol & currency cleaning is a Pro feature.");
      return;
    }
    const item = state.items[state.selectedIndex];
    if (item) renderPreview(item);
  });

  els.copyMdBtn.addEventListener("click", async () => {
    const item = state.items[state.selectedIndex];
    if (!item) return;
    if (item.kind === "list" && !requirePro(item)) return;

    const md = toMarkdown(getProcessedRows(item));
    await navigator.clipboard.writeText(md);
    setStatus("Copied Markdown table to clipboard!");
  });

  els.downloadCsvBtn.addEventListener("click", () => {
    const item = state.items[state.selectedIndex];
    if (!item) return;
    if (item.kind === "list" && !requirePro(item)) return;

    const csv = "\uFEFF" + toCSV(getProcessedRows(item));
    downloadFile(csv, `${state.pageTitle}-${item.id}.csv`, "text/csv;charset=utf-8");
    setStatus("Downloaded CSV file.");
  });

  els.downloadJsonBtn.addEventListener("click", () => {
    const item = state.items[state.selectedIndex];
    if (!item || !requirePro(item)) return;

    const data = toJSONObjects(getProcessedRows(item));
    downloadFile(
      JSON.stringify(data, null, 2),
      `${state.pageTitle}-${item.id}.json`,
      "application/json"
    );
    setStatus("Downloaded JSON file.");
  });

  els.exportAllBtn.addEventListener("click", () => {
    if (!state.items.length || !requirePro()) return;
    const bundle = state.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      records: toJSONObjects(getProcessedRows(item))
    }));
    downloadFile(
      JSON.stringify(bundle, null, 2),
      `${state.pageTitle}-all-tables.json`,
      "application/json"
    );
    setStatus(`Exported all ${state.items.length} datasets as JSON.`);
  });

  els.rescanBtn.addEventListener("click", scanActiveTab);
  els.proBadgeBtn.addEventListener("click", () => openLicenseModal(""));
  els.closeModalBtn.addEventListener("click", closeLicenseModal);
  els.activateBtn.addEventListener("click", () => verifyLicenseKey(els.licenseInput.value));
}

(async function init() {
  await loadLicenseState();
  bindEvents();
  await scanActiveTab();
})();
