# IC Nurse Console — Infection Control & Antibiotic Stewardship Console

A comprehensive, browser-based management console for Infection Control (IC) nurses in long-term care (LTC) facilities. It provides tools for resident and staff tracking, outbreak management, audit documentation, AI-powered note generation, and customizable reporting. It runs locally with browser-native IndexedDB persistence and supports real-time data synchronization across multiple devices powered by Firebase.

---

## Features

- **Dashboard** — At-a-glance overview of key infection control metrics
- **Multi-Device Sync** — Real-time data synchronization across multiple devices, powered by Firebase.
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
| Persistence | IndexedDB (primary) + Firebase (for multi-device sync) |
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

Then edit `.env.local` with your Firebase project credentials (found in the Firebase console under **Project Settings → General → Your apps**):

```env
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
```

> **Note on AI features:** The `GEMINI_API_KEY` is a **backend secret** and must never be placed in `.env.local` or any frontend env file. It must only be set in the server-side environment (Cloud Functions environment variables or Cloudflare Pages dashboard → Settings → Environment variables). AI features will gracefully degrade if the backend proxy is unavailable.

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


## User Guide

For a screen-by-screen functional walkthrough, see **[docs/user-guide-screens.md](docs/user-guide-screens.md)**. You can also open it in-app from the left sidebar via **User Guide**.

---

## License & Credits

Developed and built by **Juan Enguerra**. © 2026 All Rights Reserved.
