import axios from 'axios';

// Change this to your Render backend URL after deployment
// e.g. https://drrs-backend.onrender.com
const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE });

export const submitRecord  = (data)   => api.post('/submit', data).then(r => r.data);
export const getRecords    = (search) => api.get('/records', { params: search ? { search } : {} }).then(r => r.data);
export const getStats      = ()       => api.get('/stats').then(r => r.data);
export const clearRecords  = ()       => api.delete('/records').then(r => r.data);

// Short timeout — used purely to detect whether the backend is awake.
// Free hosting tiers (e.g. Render) sleep after inactivity and can take
// up to ~50s to respond to the request that wakes them.
export const getHealth = () => api.get('/health', { timeout: 8000 }).then(r => r.data);
