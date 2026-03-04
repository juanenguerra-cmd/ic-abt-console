import React from "react";
import { PrintShell } from "../PrintShell";
import "../print.css";

type CensusRow = {
  unit?: string;
  room?: string;
  name: string;
  mrn?: string;
  precautions?: string;
  flags?: string;
};

type CensusPayload = {
  rows?: CensusRow[];
  facility?: string;
  title?: string;
  meta?: {
    date?: string;
    unit?: string;
  };
};

function todayStr() {
  const d = new Date();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "2-digit" });
}

export default function PrintCensusRounding() {
  return (
    <PrintShell<CensusPayload>
      kind="census-rounding"
      render={(job) => {
        const rows: CensusRow[] = job?.payload?.rows || [];
        const facility = job?.payload?.facility || "Long Beach Nursing and Rehabilitation Center";
        const title = job?.payload?.title || "Census Rounds Sheet";
        const meta = job?.payload?.meta || {};

        return (
          <div className="print-root report">
            <div className="report-header no-break">
              <div className="report-facility">{facility}</div>
              <div className="report-title">{title}</div>

              <div className="report-meta">
                <div><b>Date:</b> {meta.date || todayStr()}</div>
                <div><b>Unit:</b> {meta.unit || "All"}</div>
                <div><b>Printed:</b> {new Date().toLocaleString()}</div>
              </div>
            </div>

            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ width: "10%" }}>Unit</th>
                  <th style={{ width: "10%" }}>Room</th>
                  <th style={{ width: "28%" }}>Resident</th>
                  <th style={{ width: "12%" }}>MRN</th>
                  <th style={{ width: "15%" }}>Precautions</th>
                  <th style={{ width: "25%" }} className="notes-col">Notes (Rounds)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 12 }}>No census rows found.</td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.unit || ""}</td>
                      <td>{r.room || ""}</td>
                      <td>{r.name}</td>
                      <td>{r.mrn || ""}</td>
                      <td>{r.precautions || ""}</td>
                      <td className="notes-cell" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="report-footer no-break">
              <div>Rounding Notes: Write legibly. If action needed, document follow-up in nurse notes.</div>
              <div className="report-sign">
                <span><b>Nurse:</b> _______________________</span>
                <span><b>Shift:</b> __________</span>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
