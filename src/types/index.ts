// ─── Resident ────────────────────────────────────────────────────────────────
export interface Resident {
  id: string;
  name: string;
  unit: string;
  room: string;
  dateOfBirth?: string;
  admissionDate?: string;
  status: 'active' | 'discharged';
  createdAt: string;
  updatedAt: string;
}

// ─── Antibiotic Course (ABT) ──────────────────────────────────────────────────
export interface ABT {
  id: string;
  residentId: string;
  residentName: string;
  medication: string;
  dose: string;
  route: string;
  indication: string;
  startDate: string;
  endDate: string;
  reviewDate: string;
  status: 'active' | 'completed' | 'discontinued';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Infection Prevention Event ───────────────────────────────────────────────
export interface IPEvent {
  id: string;
  residentId: string;
  residentName: string;
  infectionType: string;
  symptoms: string[];
  symptomOnsetDate: string;
  precautions: string[];
  notes?: string;
  status: 'active' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

// ─── Vaccination ──────────────────────────────────────────────────────────────
export interface Vaccination {
  id: string;
  residentId: string;
  residentName: string;
  vaccineType: string;
  status: 'administered' | 'refused' | 'contraindicated' | 'pending';
  date: string;
  lotNumber?: string;
  manufacturer?: string;
  administrationSite?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export interface Audit {
  id: string;
  type: string;
  description: string;
  score?: number;
  findings?: string;
  completedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  read: boolean;
  relatedTo?: string;
  createdAt: string;
}

// ─── Facility Settings ────────────────────────────────────────────────────────
export interface Settings {
  id: string;
  facilityName: string;
  timezone?: string;
  updatedAt: string;
}

// ─── Facility ─────────────────────────────────────────────────────────────────
export interface Facility {
  id: string;
  name: string;
  createdAt: string;
}

// ─── Collection names type ────────────────────────────────────────────────────
export type CollectionName =
  | 'residents'
  | 'abts'
  | 'ipEvents'
  | 'vaccinations'
  | 'audits'
  | 'notifications'
  | 'settings';
