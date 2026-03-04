import React from "react";
import { PrintLayout } from "./PrintLayout";
import { PrintShell } from "../../print/PrintShell";

const Page: React.FC = () => (
  <PrintShell kind="resident-census">
    {(job) => {
      const payload = (job.payload || {}) as any;
      const facility = payload.facility || {};
      return (
        <PrintLayout title="Resident Census" facilityName={facility?.name ?? ""} facilityAddress={facility?.address} dohId={facility?.dohId}>
          <div className="space-y-4">
            <div className="text-sm text-neutral-500">Generated payload print view</div>
            <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-3 overflow-auto whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        </PrintLayout>
      );
    }}
  </PrintShell>
);

export default Page;
