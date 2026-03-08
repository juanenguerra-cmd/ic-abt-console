import React from 'react';
import { ReportViewer } from './ReportViewer';

export const SymptomWatchReport: React.FC = () => {
  return (
    <ReportViewer 
      reportId="symptom-watch" 
      headerColorClass="bg-indigo-50" 
      textColorClass="text-indigo-900" 
    />
  );
};
