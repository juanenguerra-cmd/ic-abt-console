import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { ResidentCoursePDFConfigModal } from './ResidentCoursePDFConfig';
import { ResidentCoursePDFConfig } from '../../types/reportTypes';
import { generateResidentCoursePDF } from './generateResidentCoursePDF';
import { getResidentCourseData } from './hooks/residentCourseDataUtils';
import { useFacilityData } from '../../app/providers';

interface Props {
  residentId: string;
}

export const ResidentCoursePDFGenerator: React.FC<Props> = ({ residentId }) => {
  const { store } = useFacilityData();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const resident = store.residents[residentId];

  const handleGenerate = (config: ResidentCoursePDFConfig) => {
    setShowConfigModal(false);
    setIsGenerating(true);
    try {
      const data = getResidentCourseData(store, residentId, config);
      if (!data) {
        alert('Resident not found.');
        return;
      }
      generateResidentCoursePDF(data, config);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!resident) return null;

  return (
    <>
      <button
        onClick={() => setShowConfigModal(true)}
        disabled={isGenerating}
        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded disabled:opacity-50"
        title="Generate Treatment Course Summary PDF"
      >
        <FileText className="w-3.5 h-3.5" />
        {isGenerating ? 'Generating…' : 'Course Summary'}
      </button>

      {showConfigModal && (
        <ResidentCoursePDFConfigModal
          residentName={resident.displayName}
          onGenerate={handleGenerate}
          onCancel={() => setShowConfigModal(false)}
        />
      )}
    </>
  );
};

