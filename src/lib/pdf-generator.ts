import { ResidentInfo, FormTemplate } from '../types/forms';

const BASE_TEMPLATE = `
  <style>
    @page { size: letter; margin: 0.5in; }
    .form-container { font-family: Arial, sans-serif; font-size: 10.5pt; line-height: 1.4; color: #000; margin: 0; background: white; }
    .form-page { page-break-after: always; break-after: page; min-height: 9in; display: flex; flex-direction: column; }
    .form-page:last-child { page-break-after: auto; }
    .form-container h1, .form-container h2, .form-container h3, .form-container p { margin: 0; }
    .pain-resident-line { margin-bottom: 12px; font-size: 10pt; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .pain-title { color: #1e3a8a; text-align: center; font-size: 16pt; font-weight: 700; margin-bottom: 6px; }
    .pain-subtitle { text-align: center; font-size: 13pt; font-weight: 400; margin-bottom: 12px; }
    .section-title { font-size: 12pt; font-weight: 700; margin: 12px 0 6px; }
    .icon { font-weight: 700; margin-right: 6px; }
    .icon-success { color: #10b981; }
    .icon-warning { color: #f59e0b; }
    .icon-star { color: #fbbf24; }
    .icon-info { color: #3b82f6; }
    .icon-leaf { color: #22c55e; }
    .body-copy { line-height: 1.4; margin-bottom: 6px; }
    .list { margin: 6px 0 10px 24px; line-height: 1.4; }
    .list li { margin-bottom: 2px; }
    .form-container table { border-collapse: collapse; width: 100%; margin: 10px 0 14px; font-size: 10pt; }
    .form-container th, .form-container td { border: 1px solid #000; padding: 6px 10px; vertical-align: top; text-align: left; }
    .form-container th { background: #f3f4f6; }
    .form-divider { margin: 10px 0; border: 0; border-top: 1px solid #000; }
    .pain-footer { margin-top: auto; padding-top: 20px; font-size: 10pt; border-top: 1px solid #eee; }
    .vax-header { text-align: center; font-weight: 700; font-size: 12pt; margin-bottom: 4px; }
    .vax-title { font-size: 14pt; font-weight: 700; text-align: center; margin: 12px 0 8px; border-bottom: 2px solid #000; padding-bottom: 4px; }
    .resident-name-row { margin: 12px 0 16px; font-weight: 700; font-size: 11pt; }
    .underlined-heading { font-size: 11pt; font-weight: 700; text-decoration: underline; margin: 12px 0 4px; }
    .consent-paragraph { line-height: 1.4; margin-bottom: 10px; font-size: 10.5pt; }
    .signature-block { margin: 12px 0 20px; }
    .signature-line-row { display: flex; align-items: flex-end; gap: 20px; margin-bottom: 2px; }
    .signature-line { flex: 1; border-bottom: 1px solid #000; min-height: 24px; }
    .signature-date { width: 14ch; border-bottom: 1px solid #000; min-height: 24px; }
    .signature-caption { display: flex; gap: 20px; font-size: 9pt; }
    .signature-caption-label { flex: 1; }
    .signature-caption-date { width: 14ch; text-align: right; }
    .asterisk-divider { margin: 15px 0; text-align: center; letter-spacing: 1px; font-size: 9pt; color: #666; }
    .vax-footer { margin-top: auto; padding-top: 12px; font-size: 9.5pt; font-style: italic; line-height: 1.4; }
    .form-header { text-align: center; font-weight: 700; font-size: 12pt; margin-bottom: 4px; }
    .form-title { font-size: 14pt; font-weight: 700; text-align: center; margin: 12px 0 8px; border-bottom: 2px solid #000; padding-bottom: 4px; }
    .form-footer { margin-top: auto; padding-top: 12px; font-size: 9.5pt; line-height: 1.4; }
    .covid-consent-template-page { min-height: auto; padding: 0; }
    .covid-consent-image { width: 100%; height: auto; display: block; }
    img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
  <div class="form-container">
    {{content}}
  </div>
`;

function fillTemplate(templateContent: string, residentInfo: ResidentInfo, facilityName: string) {
  const currentDate = new Date().toLocaleDateString();
  return templateContent
    .replaceAll('{{residentName}}', residentInfo.name || '________________')
    .replaceAll('{{unit}}', residentInfo.unit || '________________')
    .replaceAll('{{room}}', residentInfo.roomNumber || '________________')
    .replaceAll('{{facilityName}}', facilityName || '{{ Facility name }}')
    .replaceAll('{{date}}', currentDate);
}

export function generateResidentPDF(
  residentInfo: ResidentInfo,
  selectedForms: string[],
  residentForms: FormTemplate[],
  facilityName: string
): string {
  const selectedTemplates = residentForms.filter((template) => selectedForms.includes(template.id));

  const renderedForms = selectedTemplates.map((template) => {
    const content = template.templateContent
      ? fillTemplate(template.templateContent, residentInfo, facilityName)
      : `<article class="form-page"><h1>${template.name}</h1><p>${template.description}</p><p><strong>Resident:</strong> ${residentInfo.name}</p></article>`;

    return content;
  });

  return BASE_TEMPLATE.replace('{{content}}', renderedForms.join('\n'));
}
