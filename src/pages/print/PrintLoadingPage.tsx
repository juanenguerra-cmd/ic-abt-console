import React from "react";

const PrintLoadingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-neutral-700">
      <div className="text-center">
        <p className="text-lg font-semibold">Preparing print view…</p>
        <p className="text-sm text-neutral-500 mt-2">Please keep this tab open.</p>
      </div>
    </div>
  );
};

export default PrintLoadingPage;
