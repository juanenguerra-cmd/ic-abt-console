import React, { useState } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Users, AlertCircle, FileText, Inbox, Building2 } from 'lucide-react';
import { FloorMap } from '../Heatmap/FloorMap';
import { CensusModal } from './CensusModal';
import { ActivePrecautionsModal } from './ActivePrecautionsModal';
import { AdmissionScreeningModal } from './AdmissionScreeningModal';
import { ActiveAbtModal } from './ActiveAbtModal';
import { OutbreakDrilldownModal } from './OutbreakDrilldownModal';

export const Dashboard: React.FC = () => {
  const { db } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const facility = db.data.facilities.byId[activeFacilityId];
  const layout = facility.floorLayouts?.[0];

  const [showCensusModal, setShowCensusModal] = useState(false);
  const [showPrecautionsModal, setShowPrecautionsModal] = useState(false);
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [showAbtModal, setShowAbtModal] = useState(false);
  const [showOutbreakModal, setShowOutbreakModal] = useState(false);

  // Calculate stats
  const residentCount = Object.keys(store.residents).length;
  const activePrecautionsCount = (Object.values(store.infections) as any[]).filter(ip => ip.status === 'active' && ip.isolationType).length;
  const outbreakCount = (Object.values(store.outbreaks) as any[]).filter(o => o.status !== 'closed').length;
  const abtCount = (Object.values(store.abts) as any[]).filter(a => a.status === 'active').length;
  const qCount = Object.keys(store.quarantine).length;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentAdmissions = Object.values(store.residents).filter(r => r.admissionDate && new Date(r.admissionDate) > threeDaysAgo);

  const residentsNeedingScreeningCount = recentAdmissions.filter(r => {
    const hasScreeningNote = Object.values(store.notes).some(n => 
      n.residentRef.kind === 'mrn' && 
      n.residentRef.id === r.mrn && 
      n.title?.includes('Admission Screening')
    );
    return !hasScreeningNote;
  }).length;
  
  const capacityRate = facility.bedCapacity ? ((residentCount / facility.bedCapacity) * 100).toFixed(1) : null;

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div onClick={() => setShowCensusModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Census</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-neutral-900">{residentCount}</p>
                  {capacityRate && (
                    <span className="text-xs font-medium text-neutral-500">
                      ({capacityRate}% capacity)
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowPrecautionsModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active Precautions</p>
                <p className="text-2xl font-bold text-neutral-900">{activePrecautionsCount}</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowOutbreakModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active Outbreaks</p>
                <p className="text-2xl font-bold text-neutral-900">{outbreakCount}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowScreeningModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Admission Screening</p>
                <p className="text-2xl font-bold text-neutral-900">{residentsNeedingScreeningCount}</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowAbtModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active ABTs</p>
                <p className="text-2xl font-bold text-neutral-900">{abtCount}</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Inbox className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {layout ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Live Floor Map</h2>
            <FloorMap 
              layout={layout} 
              roomStatuses={{}} // TODO: Wire up real statuses
            />
          </div>
        ) : (
          <div className="bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-xl p-12 text-center">
            <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-neutral-900">No Floor Layout Configured</h3>
            <p className="text-sm text-neutral-500 mt-1">Upload a floor layout in Settings to see the live map.</p>
          </div>
        )}
      </div>
      {showCensusModal && <CensusModal onClose={() => setShowCensusModal(false)} />}
      {showPrecautionsModal && <ActivePrecautionsModal onClose={() => setShowPrecautionsModal(false)} />}
      {showScreeningModal && <AdmissionScreeningModal onClose={() => setShowScreeningModal(false)} />}
      {showAbtModal && <ActiveAbtModal onClose={() => setShowAbtModal(false)} />}
      {showOutbreakModal && <OutbreakDrilldownModal onClose={() => setShowOutbreakModal(false)} />}
    </>
  );
};