import { ResidentInfo, FormTemplate } from '../types/forms';

const BASE_TEMPLATE = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Resident Consent Forms</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111827; margin: 20px; }
      .form-page { page-break-after: always; margin-bottom: 24px; }
      .form-page:last-child { page-break-after: auto; }
      .outlined-header { border: 1px solid #111827; padding: 12px; margin-bottom: 16px; }
      .outlined-header.centered { text-align: center; }
      .outlined-header .left { text-align: left; }
      h1 { font-size: 16pt; margin: 6px 0; font-weight: 700; }
      h2 { font-size: 14pt; text-align: center; margin: 14px 0 10px; font-weight: 700; }
      h3 { font-size: 12pt; margin: 12px 0 6px; font-weight: 700; }
      p { margin: 6px 0; }
      ul { margin: 6px 0 10px 20px; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; }
      th, td { border: 1px solid #111827; padding: 8px; vertical-align: top; text-align: left; }
      .divider { text-align: center; letter-spacing: 0.5px; margin: 18px 0; }
      .signature-row { margin-top: 20px; }
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

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${residentInfo.name || 'resident'}-forms.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
