export const IP_TEMPLATE = `mrn,residentName,dob,unit,room,onsetDate,resolutionDate,infectionType,isolationType,organism,syndrome,deviceType,status,notes
12345,Doe John,1940-01-01,Unit 1,101A,2023-01-01,2023-01-10,UTI,Contact,E. coli,Symptomatic UTI,Foley,resolved,Sample note`;

export const ABX_TEMPLATE = `mrn,residentName,dob,unit,room,startDate,endDate,medicationName,medicationClass,route,dose,frequency,indication,syndrome,sourceOfInfection,cultureCollected,prescriber,status,notes
12345,Doe John,1940-01-01,Unit 1,101A,2023-01-01,2023-01-07,Ciprofloxacin,Fluoroquinolone,PO,500mg,BID,UTI,Symptomatic UTI,Urine,Yes,Dr. Smith,completed,Sample note`;

export const VAX_TEMPLATE = `mrn,residentName,dob,vaccineType,administeredDate,dose,lotNumber,administeredBy,status,notes
12345,Doe John,1940-01-01,COVID-19,2023-01-01,1,AB1234,Nurse Jane,completed,Sample note`;

export const downloadTemplate = (type: 'IP' | 'ABX' | 'VAX') => {
  let content = '';
  let filename = '';
  switch (type) {
    case 'IP':
      content = IP_TEMPLATE;
      filename = 'ip_historical_template.csv';
      break;
    case 'ABX':
      content = ABX_TEMPLATE;
      filename = 'abx_historical_template.csv';
      break;
    case 'VAX':
      content = VAX_TEMPLATE;
      filename = 'vax_historical_template.csv';
      break;
  }
  
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('url');
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
