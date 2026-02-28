import { useState } from 'react';
import { FileText, Download, Settings, Pill, Syringe } from 'lucide-react';
import { ResidentInfo } from '../types/forms';
import { generateResidentPDF } from '../lib/pdf-generator';
import { useToast } from '../hooks/useToast';
import { useFormTemplates } from '../hooks/useFormTemplates';
import { FormTemplateManager } from './FormTemplateManager';
import { useDatabase, useFacilityData } from '../app/providers';

export function FormsTab() {
  const { toast } = useToast();
  const { residentForms } = useFormTemplates();
  const { db } = useDatabase();
  const { activeFacilityId } = useFacilityData();
  const [residentInfo, setResidentInfo] = useState<ResidentInfo>({
    name: '',
    roomNumber: '',
    unit: '',
    admissionDate: ''
  });
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [isManageOpen, setIsManageOpen] = useState(false);

  const handleInputChange = (field: keyof ResidentInfo, value: string) => {
    setResidentInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleFormToggle = (formId: string) => {
    setSelectedForms(prev =>
      prev.includes(formId)
        ? prev.filter(id => id !== formId)
        : [...prev, formId]
    );
  };

  const handleSelectAll = () => {
    if (selectedForms.length === residentForms.length) {
      setSelectedForms([]);
    } else {
      setSelectedForms(residentForms.map(f => f.id));
    }
  };

  const handleGenerate = () => {
    if (!residentInfo.name.trim()) {
      toast({
        title: 'Name required',
        description: "Please enter the resident's name",
        variant: 'destructive'
      });
      return;
    }

    if (selectedForms.length === 0) {
      toast({
        title: 'No forms selected',
        description: 'Please select at least one form to generate',
        variant: 'destructive'
      });
      return;
    }

    const facilityName = db.data.facilities.byId[activeFacilityId]?.name || '{{ Facility name }}';
    generateResidentPDF(residentInfo, selectedForms, residentForms, facilityName);

    toast({
      title: 'PDF Generated',
      description: `Generated ${selectedForms.length} form(s) for ${residentInfo.name}`,
    });
  };



  const getFormIcon = (icon?: string) => {
    if (icon === 'pill') return <Pill className="h-4 w-4 text-indigo-600" />;
    if (icon === 'syringe') return <Syringe className="h-4 w-4 text-indigo-600" />;
    return <FileText className="h-4 w-4 text-indigo-600" />;
  };

  const isFormValid = residentInfo.name.trim() && selectedForms.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resident Consent Forms</h1>
          <p className="text-muted-foreground">Generate admission forms for new residents</p>
        </div>
        <button
          type="button"
          onClick={() => setIsManageOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          <Settings className="h-4 w-4" /> Manage Forms
        </button>
      </div>

      {isManageOpen && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <FormTemplateManager category="resident" onClose={() => setIsManageOpen(false)} />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-4">
            <h2 className="text-lg font-semibold">Resident Information</h2>
            <p className="text-sm text-neutral-500">Enter the new resident's details</p>
          </div>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Full Name *</label>
              <input
                id="name"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Enter resident's full name"
                value={residentInfo.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="room" className="text-sm font-medium">Room Number</label>
              <input
                id="room"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                placeholder="e.g., 101A"
                value={residentInfo.roomNumber}
                onChange={(e) => handleInputChange('roomNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="unit" className="text-sm font-medium">Unit</label>
              <input
                id="unit"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                placeholder="e.g., Memory Care, Skilled Nursing"
                value={residentInfo.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="admission" className="text-sm font-medium">Date of Admission</label>
              <input
                id="admission"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                type="date"
                value={residentInfo.admissionDate}
                onChange={(e) => handleInputChange('admissionDate', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Consent Forms</h2>
                <p className="text-sm text-neutral-500">Select which forms to generate</p>
              </div>
              <button type="button" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm" onClick={handleSelectAll}>
                {selectedForms.length === residentForms.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto p-4">
            {residentForms.map((form) => (
              <label
                key={form.id}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-neutral-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedForms.includes(form.id)}
                  onChange={() => handleFormToggle(form.id)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {getFormIcon(form.icon)}
                    <span className="font-medium text-sm">{form.name}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{form.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!isFormValid}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-5 w-5" />
          Generate {selectedForms.length > 0 ? `${selectedForms.length} Form(s)` : 'PDF'}
        </button>
      </div>
    </div>
  );
}
