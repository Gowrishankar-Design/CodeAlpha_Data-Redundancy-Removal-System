import React, { useMemo, useState } from 'react';

const th = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '9px 12px', fontSize: 12, color: 'var(--text)',
             borderBottom: '1px solid var(--border)', wordBreak: 'break-all' };

function toCSV(records) {
  const headers = ['record_id', 'name', 'email', 'department', 'phone', 'timestamp'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = records.map(r => headers.map(h => escape(r[h])).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function downloadCSV(records) {
  const blob = new Blob([toCSV(records)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drrs-records-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RecordsTable({ records }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    );
  }, [records, query]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, email, or department…"
          style={{
            flex: 1, padding: '8px 12px', fontSize: 12,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          onClick={() => downloadCSV(filtered)}
          disabled={!filtered.length}
          title="Download the rows currently shown as a CSV file"
          style={{
            padding: '8px 14px', fontSize: 12, cursor: filtered.length ? 'pointer' : 'not-allowed',
            background: 'var(--surface2)', color: filtered.length ? 'var(--text)' : 'var(--muted)',
            border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          Export CSV
        </button>
      </div>

      {!records.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
          No records in the database yet. Submit one above to get started.
        </div>
      ) : !filtered.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
          No records match "{query}".
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['ID', 'Name', 'Email', 'Department', 'Added'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.record_id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={td}><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>{r.record_id}</span></td>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.email}</td>
                  <td style={td}>{r.department}</td>
                  <td style={{ ...td, color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
        Showing {filtered.length} of {records.length} record{records.length === 1 ? '' : 's'}.
      </div>
    </div>
  );
}
