import React from 'react';
import { clearPrecautionsPrintPayload, loadPrecautionsPrintPayload } from '../../print/precautionsPrint';

const DomPrintPage: React.FC = () => {
  const payload = React.useMemo(() => loadPrecautionsPrintPayload(), []);

  React.useEffect(() => {
    if (!payload) return;

    const run = () => {
      window.print();
      clearPrecautionsPrintPayload();
    };

    const id = window.setTimeout(run, 50);
    return () => window.clearTimeout(id);
  }, [payload]);

  if (!payload) {
    return (
      <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ marginTop: 0 }}>Print Error</h2>
        <p>Unable to prepare print report payload.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[8.5in] mx-auto p-6 bg-white text-black">
      <style>{payload.pageStyle || ''}</style>
      {payload.title ? <h1 className="text-xl font-semibold mb-4 no-break">{payload.title}</h1> : null}
      <div dangerouslySetInnerHTML={{ __html: payload.html || '' }} />
    </div>
  );
};

export default DomPrintPage;
