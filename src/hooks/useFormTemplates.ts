import { FormTemplate } from '../types/forms';

const DEFAULT_RESIDENT_FORMS: FormTemplate[] = [
  {
    id: 'consent-treatment',
    name: 'Consent for Treatment',
    description: 'General consent form for admission and treatment.',
    category: 'resident',
  },
  {
    id: 'hipaa-ack',
    name: 'HIPAA Notice Acknowledgement',
    description: 'Acknowledgement of receipt of privacy practices.',
    category: 'resident',
  },
  {
    id: 'financial-responsibility',
    name: 'Financial Responsibility Agreement',
    description: 'Resident and responsible party financial agreement.',
    category: 'resident',
  },
];

export function useFormTemplates() {
  return {
    residentForms: DEFAULT_RESIDENT_FORMS,
  };
}
