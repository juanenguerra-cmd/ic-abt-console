export const ROLE_PERMISSIONS = {
  Viewer:  ['read:residents', 'read:reports'],
  Nurse:   ['read:residents', 'write:residents', 'read:reports', 'write:shiftlog', 'write:admissionscreening'],
  ICLead:  [
    'read:residents', 'write:residents', 'read:reports', 'write:shiftlog',
    'write:outbreaks', 'write:audits', 'export:reports', 'write:abt',
    'write:admissionscreening',
  ],
  Admin:   ['*'],
} as const;
