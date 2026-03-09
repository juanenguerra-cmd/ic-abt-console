export function exportToCsv(filename: string, rows: string[][]) {
  const csvContent = rows.map(e => e.map(val => {
    const escaped = String(val ?? '').replace(/"/g, '""');
    return `"${escaped}"`;
  }).join(",")).join("\n");
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
