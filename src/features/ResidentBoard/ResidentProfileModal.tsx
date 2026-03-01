import React, { useState, useEffect } from "react";
import { X, Save, Edit2, Shield, Activity, Syringe, User } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { Resident } from "../../domain/models";

interface Props {
  residentId: string;
  onClose: () => void;
  onAddAbt: () => void;
  onAddIp: () => void;
  onAddVax: () => void;
  onEditAbt: (id: string) => void;
  onEditIp: (id: string) => void;
  onEditVax: (id: string) => void;
}

export const ResidentProfileModal: React.FC<Props> = ({ 
  residentId, 
  onClose,
  onAddAbt,
  onAddIp,
  onAddVax,
  onEditAbt,
  onEditIp,
  onEditVax
}) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  
  const resident = store.residents[residentId];
  
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
    }
  }, [resident]);

  if (!resident) return null;

  const InfoItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div>
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="font-medium text-neutral-900">{value}</p>
    </div>
  );

  const residentAbts = (Object.values(store.abts) as any[]).filter(a => a.residentRef.kind === 'mrn' && a.residentRef.id === residentId).sort((a: any, b: any) => (b.startDate || b.createdAt || '0000-00-00').localeCompare(a.startDate || a.createdAt || '0000-00-00'));
  const residentInfections = (Object.values(store.infections) as any[]).filter(i => i.residentRef.kind === 'mrn' && i.residentRef.id === residentId).sort((a: any, b: any) => (b.onsetDate || b.createdAt || '0000-00-00').localeCompare(a.onsetDate || a.createdAt || '0000-00-00'));
  const vaxEvents = (Object.values(store.vaxEvents) as any[]).filter(v => v.residentRef.kind === 'mrn' && v.residentRef.id === residentId);

  const getStatusBadgeClasses = (status: string): string => {
    if (status === 'active') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (status === 'completed') return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-neutral-100 text-neutral-600 border-neutral-300';
  };

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

  const handleSave = () => {
    updateDB((draft) => {
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
        r.payor = payor.trim() || undefined;
        r.primaryDiagnosis = primaryDiagnosis.trim() || undefined;
        r.attendingMD = attendingMD.trim() || undefined;
        r.allergies = allergiesInput.trim() ? allergiesInput.split(",").map(a => a.trim()).filter(a => a) : [];
        r.cognitiveStatus = cognitiveStatus;
        r.updatedAt = new Date().toISOString();
      }
    }, { action: 'update', entityType: 'Resident', entityId: residentId });
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            Resident Profile
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
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            )}
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 ml-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
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
                <InfoItem label="Status" value={resident.status} />
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
              </div>
            ) : (
              <div className="space-y-4">
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
              <div className="space-y-3">
                {residentAbts.map((abt: any) => {
                  const isActive = abt.status === 'active';
                  return (
                    <div key={abt.id} onClick={() => onEditAbt(abt.id)} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${isActive ? 'bg-emerald-50 border-emerald-100' : 'bg-neutral-50 border-neutral-200'}`}>
                      <Activity className={`w-5 h-5 shrink-0 mt-0.5 ${isActive ? 'text-emerald-600' : 'text-neutral-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isActive ? 'text-emerald-900' : 'text-neutral-700'}`}>
                          ABT: {abt.medication}
                          <span className={`ml-2 uppercase text-[10px] px-1.5 py-0.5 rounded border font-medium ${getStatusBadgeClasses(abt.status)}`}>{abt.status}</span>
                        </p>
                        <p className={`text-xs ${isActive ? 'text-emerald-700' : 'text-neutral-500'}`}>{abt.indication} • Started: {abt.startDate ? new Date(abt.startDate).toLocaleDateString() : 'Unknown'}{abt.endDate ? ` • Ended: ${new Date(abt.endDate).toLocaleDateString()}` : ''}</p>
                      </div>
                    </div>
                  );
                })}
                {residentInfections.map((ip: any) => {
                  const isActive = ip.status === 'active';
                  return (
                    <div key={ip.id} onClick={() => onEditIp(ip.id)} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${isActive ? 'bg-amber-50 border-amber-100' : 'bg-neutral-50 border-neutral-200'}`}>
                      <Shield className={`w-5 h-5 shrink-0 mt-0.5 ${isActive ? 'text-amber-600' : 'text-neutral-400'}`} />
                      <div>
                        <p className={`text-sm font-bold ${isActive ? 'text-amber-900' : 'text-neutral-700'}`}>
                          Infection: {ip.infectionCategory || 'Unspecified'}
                          <span className={`ml-2 uppercase text-[10px] px-1.5 py-0.5 rounded border font-medium ${getStatusBadgeClasses(ip.status)}`}>{ip.status}</span>
                        </p>
                        <p className={`text-xs ${isActive ? 'text-amber-700' : 'text-neutral-500'}`}>{ip.organism || 'Unknown Organism'} • Isolation: {ip.isolationType || 'None'}</p>
                      </div>
                    </div>
                  );
                })}
                {vaxEvents.map((vax: any) => (
                  <div key={vax.id} onClick={() => onEditVax(vax.id)} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${vax.status === 'due' || vax.status === 'overdue' ? 'bg-purple-50 border-purple-100' : 'bg-neutral-50 border-neutral-200'}`}>
                    <Syringe className={`w-5 h-5 shrink-0 mt-0.5 ${vax.status === 'due' || vax.status === 'overdue' ? 'text-purple-600' : 'text-neutral-500'}`} />
                    <div>
                      <p className={`text-sm font-bold ${vax.status === 'due' || vax.status === 'overdue' ? 'text-purple-900' : 'text-neutral-700'}`}>
                        Vaccine: {vax.vaccine} <span className="uppercase text-[10px] ml-1 px-1.5 py-0.5 bg-white rounded border">{vax.status}</span>
                      </p>
                      <p className={`text-xs ${vax.status === 'due' || vax.status === 'overdue' ? 'text-purple-700' : 'text-neutral-500'}`}>
                        {vax.status === 'given' ? `Given: ${vax.dateGiven ? new Date(vax.dateGiven).toLocaleDateString() : 'Unknown'}` : `Due: ${vax.dueDate ? new Date(vax.dueDate).toLocaleDateString() : 'Unknown'}`}
                      </p>
                    </div>
                  </div>
                ))}
                {!residentAbts.length && !residentInfections.length && !vaxEvents.length && (
                  <p className="text-sm text-neutral-500 italic">No clinical events logged.</p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
