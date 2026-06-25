import React from 'react';

const STATUS_COLOR = { ok: '#34d399', fail: '#f87171', warn: '#fbbf24', idle: '#7b82a8', active: '#6c8dfa' };

const STAGES = ['Ingestion', 'Fingerprint', 'Validation', 'Classifier', 'DB Write'];

export default function Pipeline({ stages, loading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {STAGES.map((name, i) => {
        const s = stages?.find(s => s.stage === name);
        const status = loading && !s ? 'active' : s ? s.status : 'idle';
        const msg = s ? s.message : loading && !s ? 'Processing...' : 'Waiting';
        return (
          <div key={name} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '8px 12px',
            background: 'var(--surface2)',
            borderRadius: 8,
            borderLeft: `3px solid ${STATUS_COLOR[status] || STATUS_COLOR.idle}`,
            transition: 'border-color 0.3s',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
              background: STATUS_COLOR[status] || STATUS_COLOR.idle,
              boxShadow: status === 'active' ? `0 0 6px ${STATUS_COLOR.active}` : 'none',
              transition: 'background 0.3s',
            }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 1, wordBreak: 'break-all' }}>{msg}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
