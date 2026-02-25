import React, { useState } from "react";
import { useDatabase } from "../../app/providers";
import { SurveyPacket, SurveyPacketSection } from "../../domain/models";
import { Printer, Calendar, CheckSquare } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export const PacketBuilder: React.FC = () => {
  const { updateDB } = useDatabase();
  
  const [title, setTitle] = useState(`Survey Packet - ${new Date().toLocaleDateString()}`);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [sections, setSections] = useState({
    census: true,
    precautions: true,
    abts: true,
    outbreaks: false,
    staffVax: false,
  });

  const handleGenerate = () => {
    if (!title) return alert("Please enter a title");

    updateDB((draft) => {
      const id = uuidv4();
      const facilityId = draft.data.facilities.activeFacilityId;
      
      const packetSections: SurveyPacketSection[] = [];
      let order = 0;

      // 1. Cover Sheet
      packetSections.push({
        id: uuidv4(),
        type: "cover",
        title: "Cover Sheet",
        order: order++,
        options: { startDate, endDate }
      });

      // 2. Census
      if (sections.census) {
        packetSections.push({
          id: uuidv4(),
          type: "report",
          title: "Resident Census",
          order: order++,
          options: { dataset: "residents" }
        });
      }

      // 3. Precautions (Infection List)
      if (sections.precautions) {
        packetSections.push({
          id: uuidv4(),
          type: "report",
          title: "Active Precautions Line List",
          order: order++,
          options: { dataset: "infections", filter: "active" }
        });
      }

      // 4. ABT List
      if (sections.abts) {
        packetSections.push({
          id: uuidv4(),
          type: "report",
          title: "Antibiotic Stewardship Report",
          order: order++,
          options: { dataset: "abts", filter: "active" }
        });
      }

      // 5. Outbreaks
      if (sections.outbreaks) {
        packetSections.push({
          id: uuidv4(),
          type: "outbreak",
          title: "Outbreak Logs",
          order: order++,
        });
      }

      const packet: SurveyPacket = {
        id,
        facilityId,
        title,
        createdAt: new Date().toISOString(),
        sections: packetSections,
        generatedAt: new Date().toISOString(),
        notes: `Generated for range ${startDate} to ${endDate}`
      };

      draft.data.facilityData[facilityId].surveyPackets[id] = packet;
    });

    alert("Survey Packet Generated Successfully!");
  };

  return (
    <div className="max-w-2xl mx-auto bg-white shadow-sm border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center gap-3">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Printer className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Survey Packet Builder</h2>
          <p className="text-sm text-neutral-500">Generate standardized reports for DOH surveyors</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Configuration */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Packet Title</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-9 w-full border-neutral-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="pl-9 w-full border-neutral-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-neutral-100" />

        {/* Sections */}
        <div>
          <h3 className="text-sm font-medium text-neutral-900 mb-3 flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            Included Sections
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={sections.census}
                onChange={e => setSections({...sections, census: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
              />
              <span className="text-sm text-neutral-700">Resident Census (Roster)</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={sections.precautions}
                onChange={e => setSections({...sections, precautions: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
              />
              <span className="text-sm text-neutral-700">Isolation & Precautions Line List</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={sections.abts}
                onChange={e => setSections({...sections, abts: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
              />
              <span className="text-sm text-neutral-700">Antibiotic Stewardship Log</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={sections.outbreaks}
                onChange={e => setSections({...sections, outbreaks: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
              />
              <span className="text-sm text-neutral-700">Outbreak Logs (Line Lists + SITREPs)</span>
            </label>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Printer className="w-5 h-5 mr-2" />
            Generate Survey Packet
          </button>
        </div>
      </div>
    </div>
  );
};
