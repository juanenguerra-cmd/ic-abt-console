# PDF Export / Generate PDF Review

This inventory lists current UI actions that trigger PDF generation/export.

## Dashboard modals (via `ExportPdfButton`)

1. **Active Precautions modal**
   - UI label: `Export PDF`
   - Component: `ActivePrecautionsModal`
   - Export file name: `active-precautions`
   - Source: `src/features/Dashboard/ActivePrecautionsModal.tsx`

2. **Active ABTs modal**
   - UI label: default `Export PDF`
   - Component: `ActiveAbtModal`
   - Export file name: `active-abts`
   - Source: `src/features/Dashboard/ActiveAbtModal.tsx`

3. **Outbreak (Active) modal**
   - UI label: default `Export PDF`
   - Component: `OutbreakDrilldownModal`
   - Export file name: `active-outbreaks`
   - Source: `src/features/Dashboard/OutbreakDrilldownModal.tsx`

4. **Census Rounds modal**
   - UI label: default `Export PDF`
   - Component: `CensusModal`
   - Export file name: `census-rounds`
   - Source: `src/features/Dashboard/CensusModal.tsx`

## Reports feature

5. **Line listing tab / section**
   - UI label: `Generate Line List (PDF)`
   - Handler: `handleExportLineList`
   - Source: `src/features/Reports/index.tsx`

6. **On Demand Report Builder**
   - UI label: `Export PDF`
   - Handler: `handleExportPdf`
   - Source: `src/features/Reports/index.tsx`

7. **QAPI Rollup**
   - UI label: `Export PDF`
   - Handler: `handleExportPdf`
   - Source: `src/features/Reports/index.tsx`

## Shared PDF export implementation

- `ExportPdfButton` component calls `exportPdfDocument`.
- `exportPDF` utility wraps the same underlying PDF generator for tabular report exports.
- Core builder/writer lives in `src/pdf/exportPdf.ts`.
