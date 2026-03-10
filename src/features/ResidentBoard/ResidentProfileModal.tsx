import React, { useState, useEffect, useMemo } from "react";
import { X, Save, Edit2, User, GitBranch, AlertTriangle } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { Resident } from "../../domain/models";
import {  formatDateLikeForDisplay , todayLocalDateInputValue } from '../../lib/dateUtils';
import { EMPTY_CLINICAL_DEVICES, normalizeClinicalDevices, type ClinicalDevices } from '../../utils/clinicalDevices';
import { ResidentTimeline } from './ResidentTimeline';
import { useResidentAlerts } from "../../hooks/useResidentAlerts";
import { ResidentClinicalSnapshot } from "../../components/ResidentClinicalSnapshot";

interface Props {
  residentId: string;
  onClose: () => void;
  onAddAbt: () => void;
  onAddIp: () => void;
  onAddVax: () => void;
  onEditAbt: (id: string) => void;
  onEditIp: (id: string) => void;
  onEditVax: (id: string) => void;
  onDeleteAbt: (id: string) => void;
  onDeleteIp: (id: string) => void;
  onDeleteVax: (id: string) => void;
  onStartContactTrace?: (ref: { kind: 'ipEvent'; id: string } | { kind: 'symptom'; residentMrn: string; startISO: string }) => void;
}

export const ResidentProfileModal: React.FC<Props> = ({ 
  residentId, 
  onClose,
  onAddAbt,
  onAddIp,
  onAddVax,
  onEditAbt,
  onEditIp,
  onEditVax,
  onDeleteAbt,
  onDeleteIp,
  onDeleteVax,
  onStartContactTrace,
}) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  
  const resident = store.residents[residentId];
  const alerts = useResidentAlerts(residentId);
  
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");
  const [currentUnit, setCurrentUnit] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");
  const [status, setStatus] = useState<Resident["status"]>("Active");
  const [payor, setPayor] = useState("");
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState("");
  const [attendingMD, setAttendingMD] = useState("");
  const [allergiesInput, setAllergiesInput] = useState("");
  const [cognitiveStatus, setCognitiveStatus] = useState<Resident["cognitiveStatus"]>(undefined);
  const [oxygenEnabled, setOxygenEnabled] = useState(false);
  const [oxygenMode, setOxygenMode] = useState<"PRN" | "Continuous" | null>(null);
  const [urinaryCatheter, setUrinaryCatheter] = useState(false);
  const [urinaryCatheterInsertedDate, setUrinaryCatheterInsertedDate] = useState("");
  const [indwellingCatheter, setIndwellingCatheter] = useState(false);
  const [indwellingCatheterInsertedDate, setIndwellingCatheterInsertedDate] = useState("");
  const [midline, setMidline] = useState(false);
  const [midlineInsertedDate, setMidlineInsertedDate] = useState("");
  const [picc, setPicc] = useState(false);
  const [piccInsertedDate, setPiccInsertedDate] = useState("");
  const [piv, setPiv] = useState(false);
  const [pivInsertedDate, setPivInsertedDate] = useState("");

  const clinicalDevices = useMemo<ClinicalDevices>(() => ({
    oxygen: {
      enabled: oxygenEnabled,
      mode: oxygenEnabled ? oxygenMode : null,
    },
    urinaryCatheter: { active: urinaryCatheter, insertedDate: urinaryCatheter ? (urinaryCatheterInsertedDate || null) : null },
    indwellingCatheter: { active: indwellingCatheter, insertedDate: indwellingCatheter ? (indwellingCatheterInsertedDate || null) : null },
    midline: { active: midline, insertedDate: midline ? (midlineInsertedDate || null) : null },
    picc: { active: picc, insertedDate: picc ? (piccInsertedDate || null) : null },
    piv: { active: piv, insertedDate: piv ? (pivInsertedDate || null) : null },
  }), [oxygenEnabled, oxygenMode, urinaryCatheter, urinaryCatheterInsertedDate, indwellingCatheter, indwellingCatheterInsertedDate, midline, midlineInsertedDate, picc, piccInsertedDate, piv, pivInsertedDate]);


  useEffect(() => {
    if (resident) {
      setFirstName(resident.firstName || "");
      setLastName(resident.lastName || "");
      setDob(resident.dob || "");
      setSex(resident.sex || "");
      setCurrentUnit(resident.currentUnit || "");
      setCurrentRoom(resident.currentRoom || "");
      setStatus(resident.status || "Active");
      setPayor(resident.payor || "");
      setPrimaryDiagnosis(resident.primaryDiagnosis || "");
      setAttendingMD(resident.attendingMD || "");
      setAllergiesInput(resident.allergies ? resident.allergies.join(", ") : "");
      setCognitiveStatus(resident.cognitiveStatus);
      const residentDevices = normalizeClinicalDevices(resident) || EMPTY_CLINICAL_DEVICES;
      setOxygenEnabled(Boolean(residentDevices.oxygen.enabled));
      setOxygenMode(residentDevices.oxygen.mode || null);
      setUrinaryCatheter(Boolean(residentDevices.urinaryCatheter.active));
      setUrinaryCatheterInsertedDate(residentDevices.urinaryCatheter.insertedDate || "");
      setIndwellingCatheter(Boolean(residentDevices.indwellingCatheter.active));
      setIndwellingCatheterInsertedDate(residentDevices.indwellingCatheter.insertedDate || "");
      setMidline(Boolean(residentDevices.midline.active));
      setMidlineInsertedDate(residentDevices.midline.insertedDate || "");
      setPicc(Boolean(residentDevices.picc.active));
      setPiccInsertedDate(residentDevices.picc.insertedDate || "");
      setPiv(Boolean(residentDevices.piv.active));
      setPivInsertedDate(residentDevices.piv.insertedDate || "");
    }
  }, [resident]);

  if (!resident) return null;

  const InfoItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div>
      <p className="text-sm text-neutral-500">{label}</p>
      <div className="font-medium text-neutral-900">{value}</div>
    </div>
  );

  const getAge = (dobStr?: string) => {
    const birthDate = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDB((draft) => {
        const facility = draft.data.facilityData[activeFacilityId];
        const r = facility.residents[residentId];
        if (r) {
          r.firstName = firstName.trim() || undefined;
          r.lastName = lastName.trim() || undefined;
          r.displayName = `${lastName.trim() || ''}, ${firstName.trim() || ''}`.replace(/^, | ,$|^,$/, '').trim() || r.displayName;
          r.dob = dob || undefined;
          r.sex = sex || undefined;
          r.currentUnit = currentUnit.trim() || undefined;
          r.currentRoom = currentRoom.trim() || undefined;
          r.status = status;
          if (status === 'Active') {
            r.isHistorical = false;
            r.backOfficeOnly = false;
          }
          r.payor = payor.trim() || undefined;
          r.primaryDiagnosis = primaryDiagnosis.trim() || undefined;
          r.attendingMD = attendingMD.trim() || undefined;
          r.allergies = allergiesInput.trim() ? allergiesInput.split(",").map(a => a.trim()).filter(a => a) : [];
          r.cognitiveStatus = cognitiveStatus;
          r.clinicalDevices = clinicalDevices;
          r.updatedAt = new Date().toISOString();
        }
      }, { action: 'update', entityType: 'Resident', entityId: residentId });
      setIsEditing(false);
    } catch (err) {
      // Error handled by updateDB
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            Resident Profile
            {resident.status === "Discharged" && !isEditing && (
                <button
                    onClick={() => {
                        if (confirm(`Reactivate ${resident.displayName}? This will set their status to Active.`)) {
                            updateDB(draft => {
                                const r = draft.data.facilityData[activeFacilityId].residents[residentId];
                                if (r) {
                                    r.status = "Active";
                                    r.isHistorical = false;
                                    r.backOfficeOnly = false;
                                    r.updatedAt = new Date().toISOString();
                                }
                            }, { action: 'update', entityType: 'Resident', entityId: residentId });
                        }
                    }}
                    className="ml-2 text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-200 font-medium"
                >
                    Reactivate
                </button>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save"}
              </button>
            )}
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 ml-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          {/* Clinical Snapshot */}
          {!isEditing && (
            <ResidentClinicalSnapshot residentId={residentId} />
          )}

          {/* Clinical Alerts - Keep as secondary or remove if snapshot covers it. 
              The snapshot covers it with action badges, but the full alerts might be useful too.
              I'll keep them for now but maybe reduce their prominence if needed. */}
          {alerts.length > 0 && !isEditing && (
            <section className="space-y-2">
              {alerts.map((alert, idx) => (
                <div key={idx} className={`p-3 rounded-lg border flex items-start gap-3 ${alert.category === 'ABT_STEWARDSHIP' ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold uppercase tracking-wider text-[10px] opacity-70 mb-0.5">{alert.category.replace('_', ' ')}</p>
                    <p className="text-sm font-medium leading-tight">{alert.message}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Demographics */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-4 border-b pb-1">Demographics & Location</h3>
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Last Name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">DOB</label>
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Sex</label>
                  <select value={sex} onChange={e => setSex(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">Select...</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Unit</label>
                  <input type="text" value={currentUnit} onChange={e => setCurrentUnit(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Room</label>
                  <input type="text" value={currentRoom} onChange={e => setCurrentRoom(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="Active">Active</option>
                    <option value="Discharged">Discharged</option>
                    <option value="Deceased">Deceased</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Payor</label>
                  <input type="text" value={payor} onChange={e => setPayor(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Name" value={resident.displayName} />
                <InfoItem label="MRN" value={<span className="font-mono">{resident.mrn}</span>} />
                <InfoItem label="DOB / Age" value={`${resident.dob || "Unknown"} (${getAge(resident.dob)} yrs)`} />
                <InfoItem label="Sex" value={resident.sex || "Unknown"} />
                <InfoItem label="Location" value={`${resident.currentUnit || "Unassigned"} - ${resident.currentRoom || "No Room"}`} />
                <InfoItem label="Status" value={
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${resident.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
                      {resident.status}
                    </span>
                    {resident.isHistorical && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider border border-amber-200">
                        Historical
                      </span>
                    )}
                    {resident.backOfficeOnly && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 uppercase tracking-wider border border-violet-200">
                        Back-Office
                      </span>
                    )}
                  </div>
                } />
                <InfoItem label="Admission Date" value={resident.admissionDate ? new Date(resident.admissionDate).toLocaleDateString() : "N/A"} />
                <InfoItem label="Length of Stay" value={resident.admissionDate ? `${Math.floor((new Date().getTime() - new Date(resident.admissionDate).getTime()) / (1000 * 3600 * 24))} days` : "N/A"} />
                <InfoItem label="Primary Diagnosis" value={resident.primaryDiagnosis || "None recorded"} />
                <InfoItem label="Attending MD" value={resident.attendingMD || "None recorded"} />
                <InfoItem label="Cognitive / Capacity Status" value={
                  resident.cognitiveStatus
                    ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${resident.cognitiveStatus === 'Intact' ? 'bg-green-100 text-green-800' : resident.cognitiveStatus === 'Mildly Impaired' ? 'bg-yellow-100 text-yellow-800' : resident.cognitiveStatus === 'Severely Impaired' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-700'}`}>{resident.cognitiveStatus}</span>
                    : "Not documented"
                } />
              </div>
            )}
          </section>

          {/* Clinical Info */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-4 border-b pb-1">Clinical Information</h3>
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Allergies (comma separated)</label>
                  <input type="text" value={allergiesInput} onChange={e => setAllergiesInput(e.target.value)} placeholder="e.g., Penicillin, Peanuts" className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Primary Diagnosis</label>
                  <input type="text" value={primaryDiagnosis} onChange={e => setPrimaryDiagnosis(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Attending MD</label>
                  <input type="text" value={attendingMD} onChange={e => setAttendingMD(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Cognitive / Capacity Status</label>
                  <select value={cognitiveStatus || ""} onChange={e => setCognitiveStatus((e.target.value as Resident["cognitiveStatus"]) || undefined)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">Select...</option>
                    <option value="Intact">Intact</option>
                    <option value="Mildly Impaired">Mildly Impaired</option>
                    <option value="Severely Impaired">Severely Impaired</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
                <div className="md:col-span-2 border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                  <h4 className="text-sm font-semibold text-neutral-900 mb-3">Clinical Devices &amp; Support</h4>
                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        checked={oxygenEnabled}
                        onChange={e => {
                          const enabled = e.target.checked;
                          setOxygenEnabled(enabled);
                          if (!enabled) setOxygenMode(null);
                        }}
                        className="rounded border-neutral-300"
                      />
                      Oxygen
                    </label>
                    <div className="ml-6 flex items-center gap-5">
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="radio"
                          name="oxygen-mode"
                          checked={oxygenMode === "PRN"}
                          onChange={() => setOxygenMode("PRN")}
                          disabled={!oxygenEnabled}
                        />
                        PRN
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="radio"
                          name="oxygen-mode"
                          checked={oxygenMode === "Continuous"}
                          onChange={() => setOxygenMode("Continuous")}
                          disabled={!oxygenEnabled}
                        />
                        Continuous
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-2">
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-800"><input type="checkbox" checked={urinaryCatheter} onChange={e => { const checked = e.target.checked; setUrinaryCatheter(checked); if (!checked) setUrinaryCatheterInsertedDate(""); }} className="rounded border-neutral-300" />Urinary Catheter</label>
                      {urinaryCatheter && <input type="date" value={urinaryCatheterInsertedDate} onChange={e => setUrinaryCatheterInsertedDate(e.target.value)} className="ml-6 max-w-xs border border-neutral-300 rounded-md p-2 text-sm" />}

                      <label className="inline-flex items-center gap-2 text-sm text-neutral-800"><input type="checkbox" checked={indwellingCatheter} onChange={e => { const checked = e.target.checked; setIndwellingCatheter(checked); if (!checked) setIndwellingCatheterInsertedDate(""); }} className="rounded border-neutral-300" />Indwelling Catheter</label>
                      {indwellingCatheter && <input type="date" value={indwellingCatheterInsertedDate} onChange={e => setIndwellingCatheterInsertedDate(e.target.value)} className="ml-6 max-w-xs border border-neutral-300 rounded-md p-2 text-sm" />}

                      <label className="inline-flex items-center gap-2 text-sm text-neutral-800"><input type="checkbox" checked={midline} onChange={e => { const checked = e.target.checked; setMidline(checked); if (!checked) setMidlineInsertedDate(""); }} className="rounded border-neutral-300" />Midline</label>
                      {midline && <input type="date" value={midlineInsertedDate} onChange={e => setMidlineInsertedDate(e.target.value)} className="ml-6 max-w-xs border border-neutral-300 rounded-md p-2 text-sm" />}

                      <label className="inline-flex items-center gap-2 text-sm text-neutral-800"><input type="checkbox" checked={picc} onChange={e => { const checked = e.target.checked; setPicc(checked); if (!checked) setPiccInsertedDate(""); }} className="rounded border-neutral-300" />PICC Line</label>
                      {picc && <input type="date" value={piccInsertedDate} onChange={e => setPiccInsertedDate(e.target.value)} className="ml-6 max-w-xs border border-neutral-300 rounded-md p-2 text-sm" />}

                      <label className="inline-flex items-center gap-2 text-sm text-neutral-800"><input type="checkbox" checked={piv} onChange={e => { const checked = e.target.checked; setPiv(checked); if (!checked) setPivInsertedDate(""); }} className="rounded border-neutral-300" />Peripheral IV (PIV)</label>
                      {piv && <input type="date" value={pivInsertedDate} onChange={e => setPivInsertedDate(e.target.value)} className="ml-6 max-w-xs border border-neutral-300 rounded-md p-2 text-sm" />}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-500 mb-1">Clinical Devices &amp; Support</p>
                  <div className="flex flex-wrap gap-2">
                    {clinicalDevices.oxygen.enabled && (
                      <span className="px-2 py-1 bg-sky-50 text-sky-700 text-xs font-medium rounded border border-sky-100">
                        Oxygen {clinicalDevices.oxygen.mode ? `(${clinicalDevices.oxygen.mode})` : ''}
                      </span>
                    )}
                    {clinicalDevices.urinaryCatheter.active && <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded border border-neutral-200">Urinary Catheter {clinicalDevices.urinaryCatheter.insertedDate ? `(${formatDateLikeForDisplay(clinicalDevices.urinaryCatheter.insertedDate)})` : ''}</span>}
                    {clinicalDevices.indwellingCatheter.active && <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded border border-neutral-200">Indwelling Catheter {clinicalDevices.indwellingCatheter.insertedDate ? `(${formatDateLikeForDisplay(clinicalDevices.indwellingCatheter.insertedDate)})` : ''}</span>}
                    {clinicalDevices.midline.active && <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded border border-neutral-200">Midline {clinicalDevices.midline.insertedDate ? `(${formatDateLikeForDisplay(clinicalDevices.midline.insertedDate)})` : ''}</span>}
                    {clinicalDevices.picc.active && <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded border border-neutral-200">PICC Line {clinicalDevices.picc.insertedDate ? `(${formatDateLikeForDisplay(clinicalDevices.picc.insertedDate)})` : ''}</span>}
                    {clinicalDevices.piv.active && <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded border border-neutral-200">Peripheral IV (PIV) {clinicalDevices.piv.insertedDate ? `(${formatDateLikeForDisplay(clinicalDevices.piv.insertedDate)})` : ''}</span>}
                    {!clinicalDevices.oxygen.enabled && !clinicalDevices.urinaryCatheter.active && !clinicalDevices.indwellingCatheter.active && !clinicalDevices.midline.active && !clinicalDevices.picc.active && !clinicalDevices.piv.active && (
                      <p className="text-sm text-neutral-900 italic">No clinical devices documented.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-neutral-500 mb-1">Allergies</p>
                  {resident.allergies && resident.allergies.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {resident.allergies.map((a, i) => (
                        <span key={i} className="px-2 py-1 bg-rose-50 text-rose-700 text-xs font-medium rounded border border-rose-100">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-900 italic">No known allergies.</p>
                  )}
                </div>
                
              </div>
            )}
          </section>

          {/* Timelines */}
          {!isEditing && (
            <section>
              <div className="flex justify-between items-center mb-4 border-b pb-1">
                <h3 className="text-sm font-bold text-neutral-900">Clinical Timelines</h3>
                <div className="flex gap-2">
                  {onStartContactTrace && (
                    <button 
                      onClick={() => {
                        const dateStr = window.prompt("Enter symptom onset date (YYYY-MM-DD):", todayLocalDateInputValue());
                        if (dateStr) {
                          const d = new Date(dateStr);
                          if (!isNaN(d.getTime())) {
                            onStartContactTrace({ kind: 'symptom', residentMrn: residentId, startISO: d.toISOString() });
                          } else {
                            alert("Invalid date format.");
                          }
                        }
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded"
                      title="Start Contact Trace for Symptom Onset"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      Trace Symptom
                    </button>
                  )}
                  <button onClick={onAddAbt} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded">
                    ABT
                  </button>
                  <button onClick={onAddIp} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded">
                    IP
                  </button>
                  <button onClick={onAddVax} className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded">
                    Vax
                  </button>
                </div>
              </div>
              <ResidentTimeline 
                residentId={residentId}
                onEditAbt={onEditAbt}
                onEditIp={onEditIp}
                onEditVax={onEditVax}
                onDeleteAbt={onDeleteAbt}
                onDeleteIp={onDeleteIp}
                onDeleteVax={onDeleteVax}
                onStartContactTrace={onStartContactTrace}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
