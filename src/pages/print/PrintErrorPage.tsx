import React from "react";

const PrintErrorPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const msg = params.get("msg") || "Unable to prepare printable content.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-neutral-700 p-6">
      <div className="max-w-xl w-full border border-red-200 bg-red-50 text-red-800 rounded-lg p-4">
        <h1 className="text-lg font-semibold">Print failed</h1>
        <p className="mt-2 text-sm break-words">{msg}</p>
      </div>
    </div>
  );
};

export default PrintErrorPage;
