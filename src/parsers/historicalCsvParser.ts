import Papa from 'papaparse';
import { Resident } from '../domain/models';

export type RowStatus = 'MATCHED' | 'WARNING' | 'ERROR' | 'NEW';

export interface StagingRow {
  id: string;
  type: 'IP' | 'ABX' | 'VAX';
  status: RowStatus;
  skip: boolean;
  createAsHistorical: boolean;
  linkedMrn: string | null;
  data: Record<string, string>;
  errors: string[];
}

export const parseHistoricalCsv = async (
  file: File,
  type: 'IP' | 'ABX' | 'VAX',
  existingResidents: Resident[]
): Promise<StagingRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: StagingRow[] = results.data.map((row: any, index) => {
          const mrn = row.mrn?.trim();
          const residentName = row.residentName?.trim();
          const dob = row.dob?.trim();
          
          let status: RowStatus = 'NEW';
          let linkedMrn: string | null = null;
          let errors: string[] = [];
          
          if (!mrn && !residentName) {
            status = 'ERROR';
            errors.push('Missing MRN and Name');
          } else {
            const matchedByMrn = existingResidents.find(r => r.mrn === mrn);
            const matchedByName = existingResidents.find(r => 
              r.displayName.toLowerCase() === residentName?.toLowerCase() ||
              `${r.lastName}, ${r.firstName}`.toLowerCase() === residentName?.toLowerCase() ||
              `${r.firstName} ${r.lastName}`.toLowerCase() === residentName?.toLowerCase()
            );

            if (matchedByMrn) {
              status = 'MATCHED';
              linkedMrn = matchedByMrn.mrn;
            } else if (matchedByName) {
              status = 'WARNING';
              linkedMrn = matchedByName.mrn;
              errors.push('Name matched but MRN missing or mismatched');
            } else if (mrn) {
              status = 'NEW';
            } else {
              status = 'ERROR';
              errors.push('Cannot create NEW resident without MRN');
            }
          }

          // Basic date validation
          const dateFields = ['onsetDate', 'resolutionDate', 'startDate', 'endDate', 'administeredDate', 'dob'];
          dateFields.forEach(field => {
            if (row[field]) {
              const d = new Date(row[field]);
              if (isNaN(d.getTime())) {
                status = 'ERROR';
                errors.push(`Invalid date format for ${field}`);
              }
            }
          });

          if (type === 'IP' && !row.infectionType) {
            status = 'ERROR';
            errors.push('Missing infectionType');
          }
          if (type === 'ABX' && !row.medicationName) {
            status = 'ERROR';
            errors.push('Missing medicationName');
          }
          if (type === 'VAX' && !row.vaccineType) {
            status = 'ERROR';
            errors.push('Missing vaccineType');
          }

          return {
            id: `${type}-${index}-${Date.now()}`,
            type,
            status,
            skip: false,
            createAsHistorical: status === 'NEW',
            linkedMrn,
            data: row,
            errors
          };
        });
        resolve(rows);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};
