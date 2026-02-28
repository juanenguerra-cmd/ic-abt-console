export interface ResidentInfo {
  name: string;
  roomNumber: string;
  unit: string;
  admissionDate: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: 'resident';
}
