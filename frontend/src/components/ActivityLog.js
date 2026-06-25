import React from 'react';

const CLF_STYLE = {
  UNIQUE:         { bg: 'var(--green-dim)',  border: 'var(--green)',  text: 'var(--green)',  label: 'Accepted' },
  DUPLICATE:      { bg: 'var(--red-dim)',    border: 'var(--red)',    text: 'var(--red)',    label: 'Rejected' },
  FALSE_POSITIVE: { bg: 'var(--amber-dim)',  border: 'var(--amber)',  text: 'var(--amber)',  label: 'False positive' },
};

export default function ActivityLog({ entries }) {
  if (!entries.length) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
      No activity yet. Submit a record above.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
      {entries.map((e, i) => {
        const s = CLF_STYLE[e.classification] || CLF_STYLE.UNIQUE;
        return (
          <div key={i} style={{
            background: s.bg, borderLeft: `3px solid ${s.border}`,
            borderRadius: 8, padding: '8px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: s.text, fontSize: 12 }}>{s.label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{e.time}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
              {e.name} — <span style={{ color: 'var(--muted)' }}>{e.email}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{e.reason}</div>
          </div>
        );
      })}
    </div>
  );
}
