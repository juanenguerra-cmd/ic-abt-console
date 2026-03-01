import { UserRole } from '../types';

export type Permission =
  | 'read:residents'
  | 'write:residents'
  | 'read:reports'
  | 'write:shiftlog'
  | 'write:outbreaks'
  | 'write:audits'
  | 'export:reports'
  | 'write:abt'
  | '*';

const VIEWER_PERMISSIONS: readonly Permission[] = [
  'read:residents',
  'read:reports',
];

const NURSE_PERMISSIONS: readonly Permission[] = [
  'read:residents',
  'write:residents',
  'read:reports',
  'write:shiftlog',
];

export const PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  Viewer:  VIEWER_PERMISSIONS,
  Nurse:   NURSE_PERMISSIONS,
  ICLead:  [...NURSE_PERMISSIONS, 'write:outbreaks', 'write:audits', 'export:reports', 'write:abt'],
  Admin:   ['*'],
};
