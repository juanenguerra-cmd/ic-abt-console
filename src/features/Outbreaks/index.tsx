import React, { useState } from "react";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Outbreak, OutbreakCase, OutbreakExposure, OutbreakDailyStatus } from "../../domain/models";
import { Plus, Users, Activity, FileText, AlertCircle, Calendar } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export const OutbreakManager: React.FC = () => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  const [activeOutbreakId, setActiveOutbreakId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"linelist" | "sitrep">("linelist");

  const outbreaks = (Object.values(store.outbreaks) as Outbreak[]).sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const currentOutbreak = activeOutbreakId ? store.outbreaks[activeOutbreakId] : null;

  const handleCreateOutbreak = () => {
    const title = prompt("Outbreak Title (e.g. Unit 2 COVID-19):");
    if (!title) return;
    
    updateDB((draft) => {
      const id = uuidv4();
      const facilityId = draft.data.facilities.activeFacilityId;
      draft.data.facilityData[facilityId].outbreaks[id] = {
        id,
        facilityId,
        title,
        startDate: new Date().toISOString(),
        status: "suspected",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6">
      {/* Sidebar: Outbreak List */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-neutral-200 overflow-y-auto">
        <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
          <h2 className="font-semibold text-neutral-900">Outbreaks</h2>
          <button 
            onClick={handleCreateOutbreak}
            className="p-1 hover:bg-neutral-100 rounded-full text-emerald-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <ul className="divide-y divide-neutral-100">
          {outbreaks.map((outbreak) => (
            <li 
              key={outbreak.id}
              onClick={() => setActiveOutbreakId(outbreak.id)}
              className={`p-4 cursor-pointer hover:bg-neutral-50 transition-colors ${
                activeOutbreakId === outbreak.id ? "bg-emerald-50 border-l-4 border-emerald-500" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  outbreak.status === 'confirmed' ? 'bg-red-100 text-red-700' :
                  outbreak.status === 'suspected' ? 'bg-amber-100 text-amber-700' :
                  'bg-neutral-100 text-neutral-600'
                }`}>
                  {outbreak.status}
                </span>
                <span className="text-xs text-neutral-400">
                  {new Date(outbreak.startDate).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-sm font-medium text-neutral-900 truncate">{outbreak.title}</h3>
              <p className="text-xs text-neutral-500 mt-1 truncate">{outbreak.pathogen || "Unknown Pathogen"}</p>
            </li>
          ))}
          {outbreaks.length === 0 && (
            <li className="p-8 text-center text-neutral-400 text-sm italic">
              No active outbreaks recorded.
            </li>
          )}
        </ul>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-tl-xl shadow-sm border border-neutral-200 overflow-hidden">
        {currentOutbreak ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{currentOutbreak.title}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {currentOutbreak.status.toUpperCase()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Started: {new Date(currentOutbreak.startDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex space-x-1 bg-neutral-200 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab("linelist")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === "linelist" 
                      ? "bg-white text-neutral-900 shadow-sm" 
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Line List
                </button>
                <button
                  onClick={() => setActiveTab("sitrep")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === "sitrep" 
                      ? "bg-white text-neutral-900 shadow-sm" 
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  SITREP / Daily Status
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "linelist" ? (
                <LineListView outbreakId={currentOutbreak.id} />
              ) : (
                <SitrepView outbreakId={currentOutbreak.id} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
            <Activity className="w-16 h-16 mb-4 opacity-20" />
            <p>Select an outbreak to manage details</p>
          </div>
        )}
      </div>
    </div>
  );
};

const LineListView: React.FC<{ outbreakId: string }> = ({ outbreakId }) => {
  const { store } = useFacilityData();
  
  const cases = (Object.values(store.outbreakCases) as OutbreakCase[]).filter(c => c.outbreakId === outbreakId);
  const exposures = (Object.values(store.outbreakExposures) as OutbreakExposure[]).filter(e => e.outbreakId === outbreakId);

  // Helper to get resident name safely
  const getResidentName = (ref: any) => {
    if (ref.kind === "mrn") return store.residents[ref.id]?.displayName || ref.id;
    if (ref.kind === "quarantine") return store.quarantine[ref.id]?.displayName || ref.id;
    return "Unknown";
  };

  return (
    <div className="space-y-8">
      {/* Cases Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-500" />
            Confirmed & Probable Cases
            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {cases.length}
            </span>
          </h3>
          <button className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
            + Add Case
          </button>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Resident</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Onset Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Lab Result</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-neutral-500 italic">
                    No cases recorded yet.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      {getResidentName(c.residentRef)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        c.caseStatus === 'confirmed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.caseStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {c.symptomOnsetDate || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {c.locationSnapshot?.unit} / {c.locationSnapshot?.room}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {c.result || "Pending"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Exposures Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Exposures / Monitoring
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {exposures.length}
            </span>
          </h3>
          <button className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
            + Add Exposure
          </button>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Resident</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Exposure Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Monitor Until</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Outcome</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {exposures.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-neutral-500 italic">
                    No exposures recorded yet.
                  </td>
                </tr>
              ) : (
                exposures.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      {getResidentName(e.residentRef)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {e.exposureDate || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {e.exposureType || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {e.monitoringUntil || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {e.outcome || "Monitoring"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const SitrepView: React.FC<{ outbreakId: string }> = ({ outbreakId }) => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  
  const sitreps = (Object.values(store.outbreakDailyStatuses) as OutbreakDailyStatus[])
    .filter(s => s.outbreakId === outbreakId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAddSitrep = () => {
    updateDB((draft) => {
      const id = uuidv4();
      const facilityId = draft.data.facilities.activeFacilityId;
      const today = new Date().toISOString().split('T')[0];
      
      draft.data.facilityData[facilityId].outbreakDailyStatuses[id] = {
        id,
        outbreakId,
        date: today,
        newCases: 0,
        totalCases: 0,
        newExposures: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          Daily Status Reports (SITREP)
        </h3>
        <button 
          onClick={handleAddSitrep}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Daily Report
        </button>
      </div>

      <div className="grid gap-4">
        {sitreps.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-neutral-200 rounded-lg">
            <p className="text-neutral-500">No daily reports filed yet.</p>
            <button onClick={handleAddSitrep} className="mt-2 text-blue-600 hover:underline text-sm">
              Create the first report
            </button>
          </div>
        ) : (
          sitreps.map((sitrep) => (
            <div key={sitrep.id} className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-bold text-neutral-900">
                    {new Date(sitrep.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h4>
                  <p className="text-xs text-neutral-500">Report ID: {sitrep.id.slice(0, 8)}</p>
                </div>
                <button className="text-xs text-blue-600 hover:underline">Edit Report</button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-neutral-50 p-3 rounded border border-neutral-100">
                  <span className="block text-xs font-medium text-neutral-500 uppercase">New Cases</span>
                  <span className="block text-xl font-bold text-neutral-900">{sitrep.newCases}</span>
                </div>
                <div className="bg-neutral-50 p-3 rounded border border-neutral-100">
                  <span className="block text-xs font-medium text-neutral-500 uppercase">Total Cases</span>
                  <span className="block text-xl font-bold text-neutral-900">{sitrep.totalCases}</span>
                </div>
                <div className="bg-neutral-50 p-3 rounded border border-neutral-100">
                  <span className="block text-xs font-medium text-neutral-500 uppercase">New Exposures</span>
                  <span className="block text-xl font-bold text-neutral-900">{sitrep.newExposures}</span>
                </div>
                <div className="bg-neutral-50 p-3 rounded border border-neutral-100">
                  <span className="block text-xs font-medium text-neutral-500 uppercase">Isolations</span>
                  <span className="block text-xl font-bold text-neutral-900">{sitrep.isolationCount || 0}</span>
                </div>
              </div>

              {(sitrep.staffingIssues || sitrep.suppliesIssues || sitrep.narrative) && (
                <div className="space-y-2 border-t border-neutral-100 pt-3">
                  {sitrep.narrative && (
                    <p className="text-sm text-neutral-700"><span className="font-semibold">Narrative:</span> {sitrep.narrative}</p>
                  )}
                  {sitrep.staffingIssues && (
                    <p className="text-sm text-red-600"><span className="font-semibold">Staffing:</span> {sitrep.staffingIssues}</p>
                  )}
                  {sitrep.suppliesIssues && (
                    <p className="text-sm text-amber-600"><span className="font-semibold">Supplies:</span> {sitrep.suppliesIssues}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
