import React from 'react';
import { PrintShell } from '../../print/PrintShell';

const DomPrintPage: React.FC = () => (
  <PrintShell kind="dom">
    {(job) => {
      const payload = (job.payload || {}) as { title?: string; html?: string; pageStyle?: string };
      return (
        <div className="max-w-[8.5in] mx-auto p-6 bg-white text-black">
          <style>{payload.pageStyle || ''}</style>
          {payload.title ? <h1 className="text-xl font-semibold mb-4 no-break">{payload.title}</h1> : null}
          <div dangerouslySetInnerHTML={{ __html: payload.html || '' }} />
        </div>
      );
    }}
  </PrintShell>
);

export default DomPrintPage;
