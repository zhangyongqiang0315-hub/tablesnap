(() => {
  if (window.__tableSnapInjected) return;
  window.__tableSnapInjected = true;

  const HIGHLIGHT_CLASS = "tablesnap-active-highlight";
  const STYLE_ID = "tablesnap-highlight-style";

  function ensureHighlightStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 3px solid #2563eb !important;
        outline-offset: 2px !important;
        background-color: rgba(37, 99, 235, 0.06) !important;
        transition: outline 0.15s ease;
      }
    `;
    document.head.appendChild(style);
  }

  function clearHighlight() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  function cleanText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function extractTableData(tableEl) {
    const rows = [];
    const trList = Array.from(tableEl.querySelectorAll("tr"));

    for (const tr of trList) {
      // Skip nested tables' rows if this tr belongs to a deeper table
      if (tr.closest("table") !== tableEl) continue;

      const cells = Array.from(tr.children).filter(
        (c) => c.tagName === "TH" || c.tagName === "TD"
      );
      if (cells.length === 0) continue;

      const row = [];
      for (const cell of cells) {
        const span = Math.max(1, parseInt(cell.getAttribute("colspan") || "1", 10));
        const val = cleanText(cell.innerText || cell.textContent);
        row.push(val);
        for (let i = 1; i < span; i++) {
          row.push("");
        }
      }
      if (row.some((v) => v !== "")) {
        rows.push(row);
      }
    }

    if (rows.length < 2) return null;

    const maxCols = Math.max(...rows.map((r) => r.length));
    if (maxCols < 2) return null;

    const normalized = rows.map((r) => {
      const copy = [...r];
      while (copy.length < maxCols) copy.push("");
      return copy;
    });

    return {
      rows: normalized,
      rowCount: normalized.length,
      colCount: maxCols
    };
  }

  function findTables() {
    const tables = Array.from(document.querySelectorAll("table")).filter(isElementVisible);
    const results = [];

    tables.forEach((tableEl, idx) => {
      const extracted = extractTableData(tableEl);
      if (!extracted) return;

      const caption = cleanText(tableEl.querySelector("caption")?.innerText);
      const headerPreview = extracted.rows[0].slice(0, 3).filter(Boolean).join(" | ");
      const label = caption || headerPreview || `Table ${results.length + 1}`;

      tableEl.dataset.tablesnapId = `table-${idx}`;
      results.push({
        id: `table-${idx}`,
        kind: "table",
        label: label.slice(0, 48),
        rowCount: extracted.rowCount,
        colCount: extracted.colCount,
        rows: extracted.rows
      });
    });

    return results;
  }

  function getSignature(el) {
    const cls = Array.from(el.classList || [])
      .filter((c) => !c.startsWith("tablesnap"))
      .slice(0, 2)
      .sort()
      .join(".");
    return `${el.tagName}:${cls}`;
  }

  function extractCardFields(itemEl) {
    const titleEl = itemEl.querySelector("h1, h2, h3, h4, strong, a");
    const title = cleanText(titleEl?.innerText);
    const linkEl = itemEl.querySelector("a[href]");
    const url = linkEl ? linkEl.href : "";

    const rawText = cleanText(itemEl.innerText);
    const priceMatch = rawText.match(/(?:[$€£¥]|USD|EUR|RMB)\s?\d[\d,.]*/i);
    const price = priceMatch ? priceMatch[0] : "";

    // Split remaining lines for extra detail
    const lines = (itemEl.innerText || "")
      .split(/\n+/)
      .map(cleanText)
      .filter((l) => l && l !== title && l !== price);

    const summary = lines.slice(0, 2).join(" · ").slice(0, 140);
    return [title, price, summary, url];
  }

  function findSmartLists() {
    const candidates = Array.from(
      document.querySelectorAll("ul, ol, section, div, main")
    ).filter((el) => {
      if (!isElementVisible(el)) return false;
      if (el.closest("table")) return false;
      return el.children.length >= 3 && el.children.length <= 200;
    });

    const results = [];
    const seenParents = new Set();

    for (const parent of candidates) {
      if (seenParents.has(parent)) continue;

      const children = Array.from(parent.children).filter(isElementVisible);
      if (children.length < 3) continue;

      // Group children by tag+class signature
      const groups = new Map();
      for (const child of children) {
        const sig = getSignature(child);
        if (!groups.has(sig)) groups.set(sig, []);
        groups.get(sig).push(child);
      }

      let bestGroup = [];
      for (const grp of groups.values()) {
        if (grp.length > bestGroup.length) bestGroup = grp;
      }

      if (bestGroup.length < 3) continue;

      // Ensure items have meaningful text content (avoid nav bars or icon rows)
      const extractedItems = bestGroup
        .map(extractCardFields)
        .filter((fields) => fields[0].length >= 3);

      if (extractedItems.length < 3) continue;

      // Avoid nested duplicate containers
      let hasNested = false;
      for (const other of seenParents) {
        if (parent.contains(other) || other.contains(parent)) {
          hasNested = true;
          break;
        }
      }
      if (hasNested) continue;

      seenParents.add(parent);
      const id = `list-${results.length}`;
      parent.dataset.tablesnapId = id;

      const rows = [["Title", "Price / Metric", "Details", "URL"], ...extractedItems];
      const firstTitle = extractedItems[0][0] || `List ${results.length + 1}`;

      results.push({
        id,
        kind: "list",
        label: `Smart List: ${firstTitle}`.slice(0, 48),
        rowCount: rows.length,
        colCount: 4,
        rows
      });

      if (results.length >= 8) break;
    }

    return results;
  }

  function highlightTarget(id) {
    ensureHighlightStyle();
    clearHighlight();
    if (!id) return;
    const el = document.querySelector(`[data-tablesnap-id="${CSS.escape(id)}"]`);
    if (el) {
      el.classList.add(HIGHLIGHT_CLASS);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "TABLESNAP_SCAN") {
      const tables = findTables();
      const lists = findSmartLists();
      sendResponse({
        ok: true,
        url: location.href,
        title: document.title,
        items: [...tables, ...lists]
      });
      return true;
    }

    if (msg.type === "TABLESNAP_HIGHLIGHT") {
      highlightTarget(msg.id);
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "TABLESNAP_CLEAR_HIGHLIGHT") {
      clearHighlight();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
