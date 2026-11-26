# TableSnap — Web Table & List Extractor (Chrome Extension MV3)

A lightweight, zero-backend Chrome Extension that extracts any HTML table or repeating product/data list into clean **CSV**, **Markdown**, or **JSON** in one click.

## Business Model (Zero Server Cost)
- **Free Tier**: Extract any HTML `<table>`, preview rows, copy Markdown, download UTF-8 BOM CSV (Excel-ready).
- **Pro Tier ($9.99 Lifetime via Gumroad)**: Smart Repeating-List detection (for product cards/search results without `<table>` tags), JSON export, multi-table batch export, and currency/symbol cleaning.
- **Payout**: Gumroad Direct Deposit (ACH) → WorldFirst (万里汇) USD account → Domestic bank card / Alipay.

---

## Local Testing (Right Now)
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `tablesnap-extension` folder.
4. Open `docs/index.html` in Chrome (or any Wikipedia / pricing page) and click the **TableSnap** extension icon.
5. To test Pro features locally before creating your Gumroad product, click the `FREE` badge and enter `TABLESNAP-DEV-PRO`.

---

## Launch Checklist (Clearing Account Obstacles)
1. **GitHub Pages (Free Hosting & Privacy Policy)**:
   - Push this folder to a public GitHub repo.
   - Enable **Settings → Pages** pointing to `/docs` (this publishes both the landing page and `privacy.html` required by Chrome Web Store).
2. **Gumroad + WorldFirst (Payouts)**:
   - Create a Gumroad account and publish a digital product ("TableSnap Pro — Lifetime License", `$9.99`, enable **Generate a unique license key per sale**).
   - Copy the `product_id` into `src/config.js` (`GUMROAD_PRODUCT_ID`), update `GUMROAD_PRODUCT_URL`, and set `ALLOW_DEV_TEST_KEY: false`.
   - In Gumroad **Settings → Payouts**, bind your WorldFirst USD receiving account (ACH).
3. **Chrome Web Store ($5 one-time fee)**:
   - Register at the Chrome Web Store Developer Dashboard ($5 one-time).
   - Zip this `tablesnap-extension` folder (excluding `docs/` if desired) and upload it, linking your GitHub Pages `privacy.html` URL.
