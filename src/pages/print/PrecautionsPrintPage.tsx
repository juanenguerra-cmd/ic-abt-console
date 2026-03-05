import React from 'react';
import { clearPrecautionsPrintPayload, loadPrecautionsPrintPayload } from '../../print/precautionsPrint';
import './precautions-print.css';

const PrecautionsPrintPage: React.FC = () => {
  const payload = React.useMemo(() => loadPrecautionsPrintPayload(), []);

  React.useEffect(() => {
    if (!payload) return;

    let frameOne = 0;
    let frameTwo = 0;

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        window.print();
        clearPrecautionsPrintPayload();
      });
    });

    return () => {
      if (frameOne) window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
    };
  }, [payload]);

  if (!payload) {
    return (
      <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ marginTop: 0 }}>Print Error</h2>
        <p>Unable to load precautions print payload.</p>
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
