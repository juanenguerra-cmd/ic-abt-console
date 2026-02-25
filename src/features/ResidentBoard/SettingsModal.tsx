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
  const { updateDB } = useDatabase();
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');

  useEffect(() => {
    const facility = store.facilities[activeFacilityId];
    if (facility && facility.hashtagCategories) {
      setHashtags(facility.hashtagCategories);
    } else {
      setHashtags(DEFAULT_HASHTAGS);
    }
  }, [store, activeFacilityId]);

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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Settings</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
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
        </div>
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center gap-1">
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
