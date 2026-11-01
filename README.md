# AI Web Crawler & Auto Pre-Fill Assistant (Chrome Extension)

An intelligent, AI-powered browser extension designed specifically for automated website crawling, data extraction, and form pre-filling on Data Entry portals, strictly adhering to your 14-rule specification sheet.

---

## 🌟 Key Features

1. **AI-Powered Deep Web Crawling**:
   - Fetches the target website directly in the background (bypassing CORS constraints).
   - Extracts page titles, metadata, contact info, emails, phone numbers, addresses, product counts, and profile indicators.
   - Leverages **Google Gemini API** (Gemini 1.5 Flash / Gemini 2.0 Flash) with fallback to a resilient local heuristic rule engine if offline or no key is provided.

2. **Full Compliance with Instruction Sheet**:
   - **Rule 1 (Website Status)**: Identifies Working, Not Working, Domain Expired, Non English, Under Construction, Flash Site, Redirect Site. Flags subdomains and redirects.
   - **Rule 2 (Business Type)**: Classifies between Manufacturer, Industrial Services, Exporter, Trader, Distributer, Supplier, Wholesaler, Service Provider, Online Shopping, Restricted Site, Other. (If an online shopping site also manufactures, it classifies under Manufacturer).
   - **Rule 3 (Company Profile)**: Selects "Available" or "Not Available" based on About Us / Profile / Company Overview sections.
   - **Rule 4 (Company Name)**: Full company name, removes brackets `() [] {}`, preserves country name if present, capitalizes first letter of every word (Title Case), and trims special characters.
   - **Rule 5 (Country Name)**: Full country name in Title Case. Follows specific UK rules (e.g. England/Wales/Scotland if mentioned alongside UK).
   - **Rule 6 (Company Address)**: Complete address in Title Case, automatically strips postal/ZIP codes, country name, company name, brackets, and trailing special characters. Prioritizes Headquarters.
   - **Rule 7 (State)**: Dropdown "Available" or "Not Available" (recognizes County, Province, Prefecture, State, or country capital).
   - **Rule 8 (City)**: Dropdown "Available" or "Not Available" (recognizes Town, District, Municipality, City, or country capital).
   - **Rule 9 (Email ID)**: Extracts first corporate email ID.
   - **Rule 10 (Secondary Email ID)**: Mandatory field check; fills secondary corporate email if available, otherwise leaves clean.
   - **Rule 11 (Phone Number)**: Removes international country codes (e.g., +27, +1, +44, +91), spaces, and special characters. Filters out toll-free numbers (1800, 800, etc.) and numbers starting with zero.
   - **Rule 12 (Number of Products)**: Selects "One" if 1 product, "Three" if more than three (never selects zero).
   - **Rule 13 (Product Images)**: Selects "One" if 1 image, "Three" if more than three (never selects zero).
   - **Rule 14 (Number of Product Descriptions)**: Selects "One" if 1 description, "Three" if more than three.
   - **Prohibited / Restricted Filter**: Flags and halts if site contains keywords/content for: *Porn, Adult, Medicine, Medical, Hospital, Food, Weapons (Knife), Defence, Aircraft, Aerospace, Marine, Ship, Chemical, Alcohol, Animals*. Automatically marks Business Type as **Restricted Site** and warns the user.

3. **Universal Field Automation**:
   - Automatically detects form fields by label text, placeholder, or option values.
   - Works seamlessly with standard HTML `<select>` tags as well as custom dropdowns (Bootstrap, React, Vue, Angular).
   - Dispatches native DOM events (`input`, `change`, `blur`) so form validation state updates immediately.
   - Soft green glow highlight animation on prefilled fields for quick verification.

---

## 🚀 Installation Guide

### Step 1: Open Chrome / Edge Extensions Page
- In Google Chrome, go to: `chrome://extensions`
- In Microsoft Edge, go to: `edge://extensions`
- In Brave, go to: `brave://extensions`

### Step 2: Enable Developer Mode
- Turn ON the **"Developer mode"** toggle switch (usually in the top-right corner).

### Step 3: Load the Unpacked Extension
1. Click the **"Load unpacked"** button in the top-left.
2. Navigate to and select this folder:
   ```
   d:\SoftwareWork\extension\aiextension
   ```
3. The extension **"AI Web Crawler & Auto Pre-Fill Assistant"** will now appear in your browser toolbar!

---

## 🧪 How to Test with the Included Test Portal

We have included a full offline replica of your Data Entry portal (`test_portal.html`) matching the exact layout and options from your screenshots:

1. Click on the extension icon in your Chrome toolbar.
2. In the popup, click the green button: **"Open Test Portal"** (or double-click `test_portal.html` in your browser).
3. The replica Data Entry page opens with `http://www.teflexplastics.co.za` loaded.
4. You will see:
   - A floating **"✨ AI Data Entry Assistant"** widget in the bottom-right corner.
   - An inline **"🤖 AI Crawl & Fill"** button right next to the "click here" button!
5. Click **"⚡ Auto-Crawl & Pre-Fill"**.
6. The assistant crawls the website, parses the data according to the 14 rules, and instantly pre-fills all input boxes and dropdowns!

---

## 🔑 Setting Up Google Gemini API (Optional & Recommended)

The extension includes a built-in heuristic rule-based engine that works completely offline. For superior AI comprehension, you can link a free Google Gemini API key:

1. Get a free API key from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Click the extension icon in your Chrome toolbar.
3. Paste your Gemini API key in the **"Gemini API Key"** input.
4. Select your preferred model (`Gemini 1.5 Flash` or `Gemini 2.0 Flash`).
5. Click **"Test Connection"** to verify, then click **"Save Settings"**.

---

## 📁 File Structure

```
d:\SoftwareWork\extension\aiextension\
├── manifest.json         # Manifest V3 configuration with permissions & content scripts
├── background.js        # Background service worker (CORS-free crawl & Gemini AI integration)
├── content.js           # Content script (form field auto-detection & value injector)
├── content.css          # Floating widget styling & field glow animations
├── popup.html           # Settings popup UI
├── popup.js             # Settings management & API testing logic
├── popup.css            # Popup styling
├── test_portal.html     # Offline exact replica of the Data Entry portal for testing
├── icon16.png           # 16x16 icon
├── icon48.png           # 48x48 icon
├── icon128.png          # 128x128 icon
└── README.md            # Comprehensive documentation
```

