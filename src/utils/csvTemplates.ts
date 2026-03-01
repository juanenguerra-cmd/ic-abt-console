// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  DEPRECATED — legacy CSV template utilities (v1 schema, pre-migration).     ║
// ║                                                                              ║
// ║  The active migration template system is at:                                ║
// ║    src/lib/migration/csvTemplates.ts                                        ║
// ║                                                                              ║
// ║  This file is dead code and should not be imported.                         ║
// ║  It will be deleted in a future cleanup pass.                               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/** @deprecated Use getMigrationTemplate() from src/lib/migration/csvTemplates instead. */
export const IP_TEMPLATE = `mrn,residentName,dob,unit,room,onsetDate,resolutionDate,infectionType,isolationType,organism,syndrome,deviceType,status,notes
12345,Doe John,1940-01-01,Unit 1,101A,2023-01-01,2023-01-10,UTI,Contact,E. coli,Symptomatic UTI,Foley,resolved,Sample note`;

/** @deprecated Use getMigrationTemplate() from src/lib/migration/csvTemplates instead. */
export const ABX_TEMPLATE = `mrn,residentName,dob,unit,room,startDate,endDate,medicationName,medicationClass,route,dose,frequency,indication,syndrome,sourceOfInfection,cultureCollected,prescriber,status,notes
12345,Doe John,1940-01-01,Unit 1,101A,2023-01-01,2023-01-07,Ciprofloxacin,Fluoroquinolone,PO,500mg,BID,UTI,Symptomatic UTI,Urine,Yes,Dr. Smith,completed,Sample note`;

/** @deprecated Use getMigrationTemplate() from src/lib/migration/csvTemplates instead. */
export const VAX_TEMPLATE = `mrn,residentName,dob,vaccineType,administeredDate,dose,lotNumber,administeredBy,status,notes
12345,Doe John,1940-01-01,COVID-19,2023-01-01,1,AB1234,Nurse Jane,completed,Sample note`;

/** @deprecated Use the download buttons in CsvMigrationWizard which call getMigrationTemplate(). */
export const downloadTemplate = (type: 'IP' | 'ABX' | 'VAX') => {
  let content = '';
  let filename = '';
  switch (type) {
    case 'IP':  content = IP_TEMPLATE;  filename = 'ip_historical_template.csv';  break;
    case 'ABX': content = ABX_TEMPLATE; filename = 'abx_historical_template.csv'; break;
    case 'VAX': content = VAX_TEMPLATE; filename = 'vax_historical_template.csv'; break;
  }
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};
