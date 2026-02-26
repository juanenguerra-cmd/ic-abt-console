# ICN Console

**Infection Control & Antibiotic Stewardship Console for Long-Term Care Facilities**

ICN Console is a web-based dashboard for managing infection prevention, outbreak response, and antibiotic stewardship across residents in long-term care facilities (nursing homes). It provides a unified platform for infection control nurses (ICNs) to track residents, monitor infections, manage outbreaks, and generate compliance reports.

## Features

### Resident Board
Central management interface for facility residents. Supports global search by name, MRN, or room, filtering by active status or antibiotic usage, and grouping by unit. Includes modals for editing antibiotic courses, infection prevention events, vaccination records, and resident profiles.

### Outbreak Manager
Declare and track outbreaks by pathogen, manage individual cases (probable, confirmed, ruled out), monitor exposures, and record daily situation reports including staffing and supply notes.

### Antibiotic Stewardship
Log antibiotic treatment courses with medication details, route, indication, culture results, and sensitivities. Track active courses across the facility.

### Vaccination Tracking
Record and monitor vaccination status for both residents and staff, including vaccine type, administration dates, and current status.

### Census Import
Parse facility census text to bulk-import or update resident records. Automatically routes unrecognized or missing-MRN records to a quarantine inbox for manual resolution.

### Quarantine Inbox
Resolve unmatched resident records from census imports by linking them to existing residents or creating new profiles. Supports identity aliasing for duplicate detection.

### Survey Packet Builder
Generate configurable multi-section report packets for regulatory submissions. Sections include cover page, census, precaution lists, antibiotic summaries, outbreak reports, and staff vaccination status.

### Reports & CSV Export
Export datasets (residents, antibiotic courses, infections, outbreaks, outbreak cases) to CSV with configurable field mapping, date formatting, and optional PHI redaction for non-sensitive sharing.

### Floor Map Heatmap
Visual representation of facility units with color-coded room statuses (normal, isolation, outbreak, enhanced barrier precautions). Clickable rooms for drill-down into resident details.

### Shift Log
Timestamped notes and shift commentary with resident mentions for day-to-day documentation.

### Settings & Storage Management
Configure facility details (name, bed capacity, timezone), monitor local storage usage with warnings, and manage data backups with snapshot rollback and JSON export/import.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4, Lucide React icons |
| Animation | Motion (Framer Motion) |
| State | React Context API + localStorage |
| Build | Vite 6 |
| AI | Google Gemini API (via AI Studio) |

## Project Structure

```
src/
├── app/           # Application entry point, router, and context providers
├── components/    # Shared UI components (layout shell)
├── context/       # React context for database and facility state
├── domain/        # Domain models and TypeScript interfaces
├── events/        # Event logging utilities
├── features/      # Feature modules
│   ├── Floorplan/       # Floor plan utilities
│   ├── Heatmap/         # Floor map heatmap visualization
│   ├── Notes/           # Shift log and resident notes
│   ├── Outbreaks/       # Outbreak tracking and case management
│   ├── Quarantine/      # Unmatched resident resolution
│   ├── ResidentBoard/   # Core resident management interface
│   ├── Settings/        # Facility configuration and storage
│   └── SurveyPackets/   # Report packet generation
├── pages/         # Page-level components
├── parsers/       # Census text parser for bulk import
├── reports/       # CSV export engine with PHI redaction
├── services/      # Database CRUD operations
├── storage/       # localStorage persistence, validation, and snapshots
└── types.ts       # Shared TypeScript type definitions
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file and set your Gemini API key:
   ```bash
   GEMINI_API_KEY="your-api-key-here"
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`.

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Architecture

ICN Console is a client-side application with all data persisted in the browser's localStorage. Key architectural decisions:

- **Multi-facility support**: Data is scoped per facility, allowing management of multiple sites from a single instance.
- **Referential integrity**: The storage engine validates all resident references (MRN and quarantine IDs) to prevent orphaned records.
- **Snapshot recovery**: Automatic snapshots are created before writes, enabling rollback on data corruption.
- **Storage limits**: A 5 MB cap with staged warnings (60% warning, 85% write-blocking) prevents silent data loss.
- **Offline-first**: The application works entirely in the browser with no backend dependency for core functionality.
- **PHI-aware exports**: Report generation supports anonymization by redacting MRNs and names.
