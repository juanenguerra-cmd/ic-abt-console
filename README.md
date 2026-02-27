# IC Nurse Console — Infection Control & Antibiotic Stewardship Console

A comprehensive, browser-based management console for Infection Control (IC) nurses in long-term care (LTC) facilities. It provides tools for resident and staff tracking, outbreak management, audit documentation, AI-powered note generation, and customizable reporting — all running locally with SQLite-backed persistence.

---

## Features

- **Dashboard** — At-a-glance overview of key infection control metrics
- **Resident Board** — Track residents' infection statuses and isolation precautions
- **Staff Management** — Manage staff records and assignments
- **Shift Log** — Per-shift notes and communication log
- **Note Generator** — AI-assisted clinical note generation (powered by the Gemini API)
- **Outbreak Manager** — Document and monitor active facility outbreaks
- **Reports Console** — Browse and export saved infection control reports
- **Report Builder** — Create custom reports from collected data
- **Audit Center** — Infection Control audit documentation and printable PDF reports
- **Quarantine Inbox** — Triage and manage incoming quarantine notifications
- **Settings** — Facility configuration, data backup/restore, and application preferences
- **Lock Screen** — PIN-protected app lock for shared-workstation environments

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build Tool | [Vite 6](https://vitejs.dev) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Routing | [React Router v7](https://reactrouter.com) |
| Animations | [Motion](https://motion.dev) |
| Icons | [Lucide React](https://lucide.dev) |
| AI / LLM | [Google Gemini API](https://ai.google.dev) (`@google/genai`) |
| Local Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) via [Express](https://expressjs.com) |
| Date Picker | [react-datepicker](https://reactdatepicker.com) |

---

## Prerequisites

- **Node.js** v18 or later
- A **Gemini API key** (obtain one at [Google AI Studio](https://aistudio.google.com))

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/juanenguerra-cmd/ic-abt-console.git
cd ic-abt-console
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
# Required — your Google Gemini API key
GEMINI_API_KEY="your_gemini_api_key_here"

# Required — the URL where the app is hosted (use http://localhost:3000 for local dev)
APP_URL="http://localhost:3000"
```

### 4. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Build the app for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run TypeScript type-checking (`tsc --noEmit`) |
| `npm run clean` | Remove the `dist/` build directory |

---

## Project Structure

```
ic-abt-console/
├── index.html                  # App entry point
├── src/
│   ├── app/                    # Root app shell, routing, providers, lock screen
│   ├── components/             # Shared UI components
│   ├── constants/              # Application-wide constants
│   ├── context/                # React context definitions
│   ├── domain/                 # Core business logic and data models
│   ├── events/                 # Application event bus / event types
│   ├── features/               # Feature modules (Dashboard, Outbreaks, Staff, …)
│   ├── lib/                    # Third-party library wrappers
│   ├── pages/                  # Page-level components (Audit Center, print views)
│   ├── parsers/                # Data parsing utilities
│   ├── reports/                # Report generation helpers
│   ├── services/               # External service integrations (Gemini, DB)
│   ├── storage/                # Local storage / SQLite persistence layer
│   ├── types.ts                # Shared TypeScript type definitions
│   └── utils/                  # General utility functions
├── .env.example                # Environment variable template
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## License & Credits

Developed and built by **Juan Enguerra**. © 2026 All Rights Reserved.
