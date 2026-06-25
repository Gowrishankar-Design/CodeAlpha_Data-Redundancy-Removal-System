import { useEffect, useRef, useState } from 'react';
import { getHealth } from '../api';

/**
 * Polls the backend's /health endpoint and reports connection state.
 *
 * Statuses:
 *  - 'checking' : first attempt in flight
 *  - 'online'   : backend responded
 *  - 'waking'   : first attempt(s) failed — likely a sleeping free-tier instance
 *  - 'offline'  : many attempts failed in a row — probably a real problem
 *
 * Calls onOnline() once whenever the backend transitions into the 'online'
 * state (including the very first successful check, and any reconnect after
 * a sleep/offline period), so callers can refresh data at that moment.
 */
export default function useBackendStatus(onOnline) {
  const [status, setStatus] = useState('checking');
  const attempts = useRef(0);
  const wasOnline = useRef(false);
  const timer = useRef(null);
  const onOnlineRef = useRef(onOnline);
  onOnlineRef.current = onOnline;

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        await getHealth();
        if (cancelled) return;
        attempts.current = 0;
        setStatus('online');
        if (!wasOnline.current) {
          wasOnline.current = true;
          onOnlineRef.current && onOnlineRef.current();
        }
        timer.current = setTimeout(poll, 20000); // quiet keep-alive check
      } catch {
        if (cancelled) return;
        wasOnline.current = false;
        attempts.current += 1;
        setStatus(attempts.current > 25 ? 'offline' : 'waking');
        timer.current = setTimeout(poll, attempts.current > 25 ? 10000 : 3000);
      }
    };

    poll();
    return () => { cancelled = true; clearTimeout(timer.current); };
  }, []);

  return status;
}
