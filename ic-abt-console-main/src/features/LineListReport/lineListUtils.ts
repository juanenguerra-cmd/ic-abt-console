export function formatDate(isoStr: string): string {
  if (!isoStr) return '';
  // Accept either full ISO timestamps or YYYY-MM-DD strings
  const d = new Date(isoStr.includes('T') ? isoStr : `${isoStr}T00:00:00`);
  if (isNaN(d.getTime())) return isoStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function computeAge(dob: string | undefined, asOfISO: string): string {
  if (!dob) return '';
  const birth = new Date(`${dob.slice(0, 10)}T00:00:00`);
  const asOf = new Date(`${asOfISO.slice(0, 10)}T00:00:00`);
  if (isNaN(birth.getTime()) || isNaN(asOf.getTime())) return '';
  let age = asOf.getFullYear() - birth.getFullYear();
  const m = asOf.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < birth.getDate())) age--;
  return String(Math.max(0, age));
}
