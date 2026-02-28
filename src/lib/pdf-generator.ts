import { ResidentInfo, FormTemplate } from '../types/forms';

const BASE_TEMPLATE = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Resident Consent Forms</title>
    <style>
      @page { size: letter; margin: 1in; }
      body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; margin: 0; }
      .form-page { page-break-after: always; break-after: page; }
      .form-page:last-child { page-break-after: auto; }
      h1, h2, h3, p { margin: 0; }
      .pain-resident-line { margin-bottom: 16px; }
      .pain-title { color: #1e3a8a; text-align: center; font-size: 16pt; font-weight: 700; margin-bottom: 6px; }
      .pain-subtitle { text-align: center; font-size: 14pt; font-weight: 400; margin-bottom: 12px; }
      .section-title { font-size: 12pt; font-weight: 700; margin: 12px 0 6px; }
      .icon { font-weight: 700; margin-right: 4px; }
      .icon-success { color: #10b981; }
      .icon-warning { color: #f59e0b; }
      .icon-star { color: #fbbf24; }
      .icon-info { color: #3b82f6; }
      .icon-leaf { color: #22c55e; }
      .body-copy { line-height: 1.5; margin-bottom: 6px; }
      .list { margin: 6px 0 8px 20px; line-height: 1.6; }
      .list li { margin-bottom: 2px; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0 10px; font-size: 10pt; }
      th, td { border: 1px solid #000; padding: 8px; vertical-align: top; text-align: left; }
      th { background: #f3f4f6; }
      .form-divider { margin: 10px 0; border: 0; border-top: 1px solid #000; }
      .pain-footer { margin-top: 16px; }
      .vax-header { text-align: center; font-weight: 700; }
      .vax-title { font-size: 14pt; font-weight: 700; text-align: center; margin: 8px 0; }
      .resident-name-row { margin: 10px 0 14px; }
      .underlined-heading { font-size: 12pt; font-weight: 700; text-decoration: underline; margin: 8px 0 4px; }
      .consent-paragraph { line-height: 1.5; margin-bottom: 8px; }
      .signature-block { margin: 12px 0 16px; }
      .signature-line-row { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 2px; }
      .signature-line { flex: 1; border-bottom: 1px solid #000; min-height: 30px; }
      .signature-date { width: 15ch; border-bottom: 1px solid #000; min-height: 30px; }
      .signature-caption { display: flex; gap: 16px; font-size: 10pt; }
      .signature-caption-label { flex: 1; }
      .signature-caption-date { width: 15ch; text-align: right; }
      .asterisk-divider { margin: 16px 0; text-align: center; letter-spacing: 0.4px; }
      .vax-footer { margin-top: 10px; font-size: 10pt; font-style: italic; }
    </style>
  </head>
  <body>
    {{content}}
  </body>
</html>
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
) {
  const selectedTemplates = residentForms.filter((template) => selectedForms.includes(template.id));

  const renderedForms = selectedTemplates.map((template) => {
    const content = template.templateContent
      ? fillTemplate(template.templateContent, residentInfo, facilityName)
      : `<article class="form-page"><h1>${template.name}</h1><p>${template.description}</p><p><strong>Resident:</strong> ${residentInfo.name}</p></article>`;

    return content;
  });

  const html = BASE_TEMPLATE.replace('{{content}}', renderedForms.join('\n'));

  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) {
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
