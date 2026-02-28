import { ResidentInfo } from '../types/forms';

export function generateResidentPDF(residentInfo: ResidentInfo, selectedForms: string[]) {
  const content = [
    'Resident Consent Forms',
    `Name: ${residentInfo.name}`,
    `Room Number: ${residentInfo.roomNumber || 'N/A'}`,
    `Unit: ${residentInfo.unit || 'N/A'}`,
    `Admission Date: ${residentInfo.admissionDate || 'N/A'}`,
    '',
    'Selected Forms:',
    ...selectedForms.map((form, index) => `${index + 1}. ${form}`),
  ].join('\n');

  const blob = new Blob([content], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${residentInfo.name || 'resident'}-forms.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
