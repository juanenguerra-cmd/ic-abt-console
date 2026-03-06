import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { useDatabase, useFacilityData } from '../../app/providers';

interface Props {
  onClose: () => void;
}

const DEFAULT_HASHTAGS = [
  "#Symptom",
  "#Fall",
  "#Behavior",
  "#Skin",
  "#Family",
  "#MD",
  "#Appointment",
  "#Medication",
  "#Incident",
  "#ShiftReport",
  "#Admission",
  "#Discharge",
  "#Infection",
  "#Vaccination",
];

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { db, updateDB, setDB } = useDatabase();
  const [activeTab, setActiveTab] = useState<'hashtags' | 'database'>('hashtags');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');

  useEffect(() => {
    const facility = db.data.facilities.byId[activeFacilityId];
    if (facility && facility.hashtagCategories) {
      setHashtags(facility.hashtagCategories);
    } else {
      setHashtags(DEFAULT_HASHTAGS);
    }
  }, [db.data.facilities.byId, activeFacilityId]);

  const addHashtag = () => {
    let tagToAdd = newHashtag.trim();
    if (!tagToAdd.startsWith('#')) {
      tagToAdd = `#${tagToAdd}`;
    }
    if (tagToAdd.length > 1 && !hashtags.includes(tagToAdd)) {
      setHashtags([...hashtags, tagToAdd]);
      setNewHashtag('');
    }
  };

  const removeHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    updateDB(draft => {
      const facility = draft.data.facilities.byId[activeFacilityId];
      if (facility) {
        facility.hashtagCategories = hashtags;
      }
    });
    onClose();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ic-abt-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.data && json.data.facilities) {
          if (confirm('Are you sure you want to import this database? This will overwrite all current data.')) {
            setDB(json);
            alert('Database imported successfully. The page will now reload.');
            window.location.reload();
          }
        } else {
          alert('Invalid database file format.');
        }
      } catch (err) {
        alert('Failed to parse database file.');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm('Are you absolutely sure? This will wipe ALL data and reset the application to factory defaults.')) {
      localStorage.clear();
      // Also clear IndexedDB if possible, but localStorage.clear() is what providers.tsx uses for hard reset
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Settings</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 px-6">
          <button 
            onClick={() => setActiveTab('hashtags')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'hashtags' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
          >
            Hashtags
          </button>
          <button 
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'database' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
          >
            Database
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'hashtags' ? (
            <>
              <h3 className="text-sm font-bold text-neutral-900 mb-3">Shift Report Hashtags</h3>
              <p className="text-sm text-neutral-600 mb-4">Manage the hashtag categories used for shift reports.</p>
              <div className="space-y-2 mb-4">
                {hashtags.map(tag => (
                  <div key={tag} className="flex items-center justify-between bg-neutral-100 p-2 rounded-md">
                    <span className="text-sm font-medium text-indigo-700">{tag}</span>
                    <button onClick={() => removeHashtag(tag)} className="text-neutral-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHashtag}
                  onChange={e => setNewHashtag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addHashtag()}
                  placeholder="Add new tag..."
                  className="flex-1 border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button onClick={addHashtag} className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 mb-1">Backup & Restore</h3>
                <p className="text-xs text-neutral-500 mb-4">Export your data to a file or restore from a previous backup.</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleExport}
                    className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-neutral-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2 group-hover:bg-indigo-200">
                      <Save className="w-5 h-5 text-indigo-600" />
                    </div>
                    <span className="text-sm font-semibold text-neutral-900">Export Data</span>
                    <span className="text-[10px] text-neutral-500 mt-1">Download JSON backup</span>
                  </button>

                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-neutral-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all group cursor-pointer">
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2 group-hover:bg-emerald-200">
                      <Plus className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-neutral-900">Import Data</span>
                    <span className="text-[10px] text-neutral-500 mt-1">Upload JSON backup</span>
                  </label>
                </div>
              </div>

              <div className="pt-6 border-t border-neutral-100">
                <h3 className="text-sm font-bold text-red-600 mb-1">Danger Zone</h3>
                <p className="text-xs text-neutral-500 mb-4">These actions are irreversible. Please be careful.</p>
                
                <button 
                  onClick={handleReset}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-medium text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Reset Application Database
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium">Cancel</button>
          {activeTab === 'hashtags' && (
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center gap-1">
              <Save className="w-4 h-4" /> Save Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
