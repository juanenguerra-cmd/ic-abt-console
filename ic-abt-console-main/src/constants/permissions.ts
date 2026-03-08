export const ROLE_PERMISSIONS = {
  Viewer:  ['read:residents', 'read:reports'],
  Nurse:   ['read:residents', 'write:residents', 'read:reports', 'write:shiftlog'],
  ICLead:  [
    'read:residents', 'write:residents', 'read:reports', 'write:shiftlog',
    'write:outbreaks', 'write:audits', 'export:reports', 'write:abt',
  ],
  Admin:   ['*'],
} as const;
