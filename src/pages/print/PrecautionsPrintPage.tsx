import React from 'react';
import { clearPrecautionsPrintPayload, loadPrecautionsPrintPayload, PrecautionsPrintPayload } from '../../print/precautionsPrint';
import './precautions-print.css';

const isValidPayload = (payload: PrecautionsPrintPayload | null): payload is PrecautionsPrintPayload => {
  if (!payload) return false;
  if (!payload.facilityName || !payload.unitLabel || !payload.printedDate) return false;
  if (!Array.isArray(payload.rows)) return false;
  return payload.rows.every((row) =>
    typeof row.room === 'string' &&
    typeof row.residentName === 'string' &&
    typeof row.precautionType === 'string' &&
    typeof row.indication === 'string' &&
    typeof row.startDate === 'string' &&
    typeof row.organism === 'string' &&
    typeof row.status === 'string'
  );
};

const PrecautionsPrintPage: React.FC = () => {
  const rawPayload = React.useMemo(() => loadPrecautionsPrintPayload(), []);
  const payload = React.useMemo(() => (isValidPayload(rawPayload) ? rawPayload : null), [rawPayload]);

  React.useEffect(() => {
    if (!payload) return;

    const openedAsPopup = Boolean(window.opener && !window.opener.closed);
    let frameOne = 0;
    let frameTwo = 0;

    const handleAfterPrint = () => {
      clearPrecautionsPrintPayload();
      if (openedAsPopup) {
        window.close();
      }
    };

    window.onafterprint = handleAfterPrint;

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        window.print();
      });
    });

    return () => {
      if (frameOne) window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
      if (window.onafterprint === handleAfterPrint) {
        window.onafterprint = null;
      }
    };
  }, [payload]);

  if (!payload) {
    return (
      <div style={{ padding: 24, fontFamily: 'Arial, sans-serif', maxWidth: 640 }}>
        <h2 style={{ marginTop: 0 }}>Couldn&apos;t prepare print report</h2>
        <p>
          We couldn&apos;t find a valid precautions print payload. Please return to Active Precautions and click
          <strong> Print Precaution List</strong> again.
        </p>
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            marginTop: 12,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="print-wrap">
      <h1 className="report-title">{payload.facilityName}</h1>
      <h2 className="report-subtitle">Active Precautions Report</h2>
      <div className="meta">
        <span>Unit: {payload.unitLabel}</span>
        <span>Date: {payload.printedDate}</span>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: '9%' }}>Room</th>
            <th style={{ width: '23%' }}>Resident</th>
            <th style={{ width: '14%' }}>Type</th>
            <th style={{ width: '20%' }}>Indication</th>
            <th style={{ width: '12%' }}>Start Date</th>
            <th style={{ width: '12%' }}>Organism</th>
            <th style={{ width: '10%' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {payload.rows.map((row, index) => (
            <tr key={`${row.residentName}-${index}`}>
              <td>{row.room}</td>
              <td>{row.residentName}</td>
              <td>{row.precautionType}</td>
              <td>{row.indication}</td>
              <td>{row.startDate}</td>
              <td>{row.organism}</td>
              <td>{row.status}</td>
            </tr>
          ))}
          {payload.rows.length === 0 && (
            <tr>
              <td colSpan={7}>No active precautions.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PrecautionsPrintPage;
