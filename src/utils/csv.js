export function downloadCsv(rows, filename = 'leads.csv') {
  if (!rows.length) return;
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const content = [columns.map(escape).join(','), ...rows.map(row => columns.map(key => escape(row[key])).join(','))].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const split = line => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.slice(0, -1).map(value => value.replace(/,$/, '').replace(/^"|"$/g, '').replaceAll('""', '"')) || [];
  const headers = split(lines[0]).map(value => value.trim().toLowerCase());
  return lines.slice(1).filter(Boolean).map(line => {
    const values = split(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}