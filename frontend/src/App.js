import React, { useState, useEffect, useCallback } from 'react';
import Pipeline from './components/Pipeline';
import RecordsTable from './components/RecordsTable';
import ActivityLog from './components/ActivityLog';
import useBackendStatus from './hooks/useBackendStatus';
import { submitRecord, getRecords, clearRecords } from './api';

const SAMPLES = [
  { name: 'Arjun Sharma',  email: 'arjun.sharma@techcorp.com',  department: 'Engineering' },
  { name: 'Priya Nair',    email: 'priya.nair@techcorp.com',    department: 'Marketing'   },
  { name: 'Arjun Sharma',  email: 'arjun.sharma@techcorp.com',  department: 'Engineering' },
  { name: 'Arjun Sharme',  email: 'arjun.sharma@techcorp.com',  department: 'Engineering' },
  { name: 'Kavitha Reddy', email: 'kavitha.r@techcorp.com',     department: 'Finance'     },
  { name: 'Priya Nair',    email: 'priya.nair@techcorp.com',    department: 'HR'          },
];

const CLF_BANNER = {
  UNIQUE:         { bg: '#0d3326', border: '#34d399', text: '#34d399', icon: '✓', label: 'Accepted — record is unique' },
  DUPLICATE:      { bg: '#3b1111', border: '#f87171', text: '#f87171', icon: '✗', label: 'Rejected — duplicate detected' },
  FALSE_POSITIVE: { bg: '#3b2a00', border: '#fbbf24', text: '#fbbf24', icon: '⚠', label: 'False positive — accepted as unique' },
};

const STATUS_META = {
  checking: { color: 'var(--muted)',  label: 'Connecting to backend…' },
  online:   { color: 'var(--green)',  label: 'Backend connected — data is persisted' },
  waking:   { color: 'var(--amber)',  label: 'Waking up backend…' },
  offline:  { color: 'var(--red)',    label: "Can't reach backend" },
};

const statCard = (num, label, color) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', flex: 1, minWidth: 100 }}>
    <div style={{ fontSize: 28, fontWeight: 600, color, lineHeight: 1 }}>{num}</div>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
  </div>
);

const card = (children, style = {}) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, ...style }}>
    {children}
  </div>
);

const label = (text) => (
  <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, display: 'block', marginBottom: 5 }}>{text}</label>
);

const input = (props) => (
  <input {...props} style={{
    width: '100%', padding: '9px 12px', fontSize: 13,
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text)', outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
    ...props.style,
  }}
    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
    onBlur={e => e.target.style.borderColor = 'var(--border)'}
  />
);

export default function App() {
  const [form, setForm]         = useState({ name: '', email: '', department: '', phone: '' });
  const [threshold, setThreshold] = useState(80);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [records, setRecords]   = useState([]);
  const [log, setLog]           = useState([]);
  const [stats, setStats]       = useState({ total: 0, accepted: 0, duplicate: 0, fp: 0 });
  const [sampleIdx, setSampleIdx] = useState(0);
  const [tab, setTab]           = useState('db');
  const [error, setError]       = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchRecords = useCallback(async () => {
    try { setRecords(await getRecords()); } catch {}
  }, []);

  // Polls /health in the background; refreshes records the moment the
  // backend becomes reachable (covers first load and any reconnect after
  // a free-tier sleep/wake cycle).
  const backendStatus = useBackendStatus(fetchRecords);
  const statusMeta = STATUS_META[backendStatus];

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (!form.name || !form.email || !form.department) {
      setError('Please fill in Name, Email, and Department.');
      return;
    }
    setLoading(true);
    setResult(null);
    setPipeline([]);
    try {
      const res = await submitRecord({ ...form, threshold: threshold / 100 });
      setPipeline(res.pipeline);
      setResult(res);
      setStats(s => ({
        total:     s.total + 1,
        accepted:  s.accepted  + (res.accepted ? 1 : 0),
        duplicate: s.duplicate + (res.classification === 'DUPLICATE' ? 1 : 0),
        fp:        s.fp        + (res.classification === 'FALSE_POSITIVE' ? 1 : 0),
      }));
      setLog(l => [{ ...res, name: form.name, email: form.email, time: new Date().toLocaleTimeString() }, ...l]);
      if (res.accepted) fetchRecords();
    } catch (e) {
      const msg = e.response?.data?.detail;
      setError(Array.isArray(msg) ? msg.map(m => m.msg).join(', ') : (msg || 'Backend unreachable. Is it running?'));
    }
    setLoading(false);
  };

  const handleClear = async () => {
    if (!window.confirm('Permanently delete every record from the database? This cannot be undone.')) {
      return;
    }
    setClearing(true);
    try {
      await clearRecords();
      setRecords([]);
      setLog([]);
      setResult(null);
      setPipeline([]);
      setStats({ total: 0, accepted: 0, duplicate: 0, fp: 0 });
    } catch {
      setError('Could not clear the database — backend unreachable.');
    }
    setClearing(false);
  };

  const loadSample = () => {
    setForm({ ...SAMPLES[sampleIdx % SAMPLES.length], phone: '' });
    setSampleIdx(i => i + 1);
  };

  const banner = result ? CLF_BANNER[result.classification] : null;
  const showConnectionBanner = backendStatus === 'waking' || backendStatus === 'offline';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          title={statusMeta.label}
          style={{
            width: 8, height: 8, borderRadius: '50%', background: statusMeta.color,
            boxShadow: backendStatus !== 'online' ? `0 0 6px ${statusMeta.color}` : 'none',
            transition: 'background 0.3s', flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.2px' }}>Data Redundancy Removal System</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>v2.0</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {showConnectionBanner && (
          <div className="drrs-conn-banner" style={{
            background: backendStatus === 'offline' ? 'var(--red-dim)' : 'var(--amber-dim)',
            border: `1px solid ${backendStatus === 'offline' ? 'var(--red)' : 'var(--amber)'}`,
            color: backendStatus === 'offline' ? 'var(--red)' : 'var(--amber)',
            fontSize: 12, padding: '10px 14px', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="drrs-spinner" aria-hidden="true" />
            {backendStatus === 'waking'
              ? 'Waking up the backend — free hosting tiers sleep after inactivity, so this can take up to a minute on the first request.'
              : "Can't reach the backend right now. Check that it's running and that REACT_APP_API_URL in the frontend's .env points to the right address."}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {statCard(stats.total,     'Total submitted', 'var(--text)')}
          {statCard(stats.accepted,  'Accepted',        'var(--green)')}
          {statCard(stats.duplicate, 'Duplicates',      'var(--red)')}
          {statCard(stats.fp,        'False positives', 'var(--amber)')}
        </div>

        {/* Main two-column layout */}
        <div className="drrs-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Left: Form */}
          {card(
            <>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Submit new record</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>{label('Name')}{input({ placeholder: 'e.g. Arjun Sharma', value: form.name, onChange: set('name') })}</div>
                <div>{label('Email')}{input({ placeholder: 'e.g. user@example.com', value: form.email, onChange: set('email'), type: 'email' })}</div>
                <div>
                  {label('Department')}
                  <select value={form.department} onChange={set('department')} style={{
                    width: '100%', padding: '9px 12px', fontSize: 13,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 8, color: form.department ? 'var(--text)' : 'var(--muted)',
                    outline: 'none', fontFamily: 'inherit',
                  }}>
                    <option value="">Select department...</option>
                    {['Engineering', 'Marketing', 'Finance', 'HR', 'Operations'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>{label('Phone (optional)')}{input({ placeholder: 'e.g. +91 98765 43210', value: form.phone, onChange: set('phone') })}</div>

                <div>
                  {label(`Similarity threshold: ${threshold}%`)}
                  <input type="range" min="60" max="100" value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    <span>60% — loose</span><span>100% — exact only</span>
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={handleSubmit} disabled={loading} style={{
                  flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
                  opacity: loading ? 0.6 : 1, fontFamily: 'inherit',
                }}>
                  {loading ? 'Processing...' : 'Submit record'}
                </button>
                <button onClick={loadSample} style={{
                  padding: '10px 14px', fontSize: 13, cursor: 'pointer',
                  background: 'var(--surface2)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit',
                }}>Load sample</button>
                <button onClick={handleClear} disabled={clearing} style={{
                  padding: '10px 14px', fontSize: 13, cursor: clearing ? 'not-allowed' : 'pointer',
                  background: 'var(--surface2)', color: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit',
                  opacity: clearing ? 0.6 : 1,
                }}>{clearing ? 'Clearing…' : 'Reset DB'}</button>
              </div>

              {banner && (
                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: banner.bg, border: `1px solid ${banner.border}`,
                  borderRadius: 8, fontSize: 13, color: banner.text, fontWeight: 500,
                }}>
                  {banner.icon} {banner.label}
                  {result.similarity_score > 0 && (
                    <span style={{ fontWeight: 400, marginLeft: 8, color: 'inherit', opacity: 0.8 }}>
                      ({Math.round(result.similarity_score * 100)}% similarity)
                    </span>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4, opacity: 0.8 }}>{result.reason}</div>
                </div>
              )}
            </>
          )}

          {/* Right: Pipeline */}
          {card(
            <>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Validation pipeline</div>
              <Pipeline stages={pipeline} loading={loading} />
            </>
          )}
        </div>

        {/* Bottom: DB / Log tabs */}
        {card(
          <>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              {['db', 'log'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '6px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 6,
                  border: 'none', fontFamily: 'inherit',
                  background: tab === t ? 'var(--accent-dim)' : 'transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: tab === t ? 600 : 400,
                }}>
                  {t === 'db' ? `Database (${records.length})` : `Activity log (${log.length})`}
                </button>
              ))}
            </div>
            {tab === 'db' ? <RecordsTable records={records} /> : <ActivityLog entries={log} />}
          </>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', padding: '4px 0 12px' }}>
          Records are stored in a persistent database — they remain after the backend restarts or sleeps.
        </div>

      </div>
    </div>
  );
}
