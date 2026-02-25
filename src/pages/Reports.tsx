import React from "react";
import { useDB } from "../context/DBContext";
import { Activity, Download, FileText } from "lucide-react";

export function Reports() {
  const { store } = useDB();

  const handleExportLineList = () => {
    const residents = Object.values(store.residents) as import("../types").Resident[];
    const infections = Object.values(store.infections) as import("../types").IPEvent[];
    
    // Simple CSV generation
    const headers = ["MRN", "Name", "Unit", "Room", "Infection Status", "Organism"];
    const rows = residents.map((r) => {
      const activeInfections = infections.filter(
        (i) => i.residentRef.kind === "mrn" && i.residentRef.id === r.mrn && i.status === "active"
      );
      return [
        r.mrn,
        r.displayName,
        r.currentUnit || "",
        r.currentRoom || "",
        activeInfections.length > 0 ? "Active Infection" : "None",
        activeInfections.map((i) => i.organism).join(", ") || "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "infection_line_list.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">Reports & Exports</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-emerald-100 rounded-md p-3">
                <Activity className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-neutral-900">Infection Line List</h3>
                <p className="mt-1 text-sm text-neutral-500">DOH-ready CSV export of active infections.</p>
              </div>
            </div>
          </div>
          <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200">
            <button
              onClick={handleExportLineList}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
            >
              <Download className="mr-2 h-4 w-4" /> Download CSV
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-neutral-900">Survey Packet</h3>
                <p className="mt-1 text-sm text-neutral-500">Generate a complete packet for surveyors.</p>
              </div>
            </div>
          </div>
          <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200">
            <button
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50"
            >
              <FileText className="mr-2 h-4 w-4" /> Generate PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
