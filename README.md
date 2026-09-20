# Blackboard TaskSync & Calendar Exporter

A privacy-first, 100% local-first Google Chrome Extension (Manifest V3) built with TypeScript, React, TailwindCSS, and Vite that aggregates upcoming Blackboard assignments, quizzes, tests, and discussion deadlines into an actionable To-Do workspace, and provides one-click export to standards-compliant RFC 5545 `.ics` calendar files.

## Key Features

- **100% Local-First & FERPA/GDPR Compliant:** All task items, course mappings, and settings reside strictly in your browser (`chrome.storage.local`). Zero telemetry, zero external servers.
- **Multi-Mode Extraction Engine:**
  - **Ultra REST API:** Queries internal session endpoints (`/learn/api/public/v1/calendars/items`).
  - **Legacy Calendar API:** Queries `/webapps/calendar/calendarData/selectedCalendarEvents`.
  - **DOM Scraper Fallback:** Content script parses Blackboard Activity Stream (`/ultra/stream`) and course gradebook/calendar DOM.
  - **Demo Mode:** Realistic preloaded university course deadlines (Operating Systems, Algorithms, Linear Algebra, HCI) for immediate testing and demonstration without active school credentials.
- **Interactive To-Do Workspace:**
  - **Action Popup (380×520px):** Quick glance at tasks due in the next 48 hours, urgency badges (Red `<24h`, Orange `<72h`, Green `>3 days`), one-click completion toggling, and quick export.
  - **Full Side Panel Dashboard:** Full-height task management workspace with search, course filter pills, urgency grouping (Overdue, Due Today, Due This Week, Later), custom task creation, subtasks checklists, and direct deep-links to Blackboard submission portals.
- **RFC 5545 Calendar Generation Engine:**
  - Zero-dependency, standards-compliant `.ics` exporter compatible with Google Calendar, Apple Calendar, and Outlook.
  - Configurable `VALARM` notifications (e.g. 24 hours prior, 2 hours prior).
  - Choice of single unified `.ics` file or separate files per course (allowing distinct calendar colors in Google Calendar).
- **Chrome Action Badge Counter:**
  - Dynamically displays a red badge count on the extension icon indicating incomplete deadlines due within the next 24 hours.

---

## Installation (Loading in Chrome)

1. Clone or download this repository:
   ```bash
   cd blackboard-organizer
   ```
2. Install dependencies and build the extension:
   ```bash
   npm install
   npm run build
   ```
   This generates the complete, ready-to-load extension in the `dist/` directory.
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode** using the toggle in the top-right corner.
5. Click **Load unpacked** and select the `dist/` directory in this project.
6. The **Blackboard TaskSync** icon will appear in your Chrome toolbar!

---

## Development & Testing

- **Run Dev Server (Live Preview):**
  ```bash
  npm run dev
  ```
  Opens the Side Panel interface at `http://localhost:5173/src/sidepanel/index.html`.
- **Run RFC 5545 Automated Tests:**
  ```bash
  npm test
  ```
  Validates ISO UTC date formatting, text escaping, line folding (<= 75 octets), VALARM alerts, course grouping, and filter scopes.
- **Build Production Extension:**
  ```bash
  npm run build
  ```
