import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/routes';

const getServerUrl = () => {
  // 1. Try localStorage (set via settings)
  const stored = localStorage.getItem('smartlaw_server_url');
  if (stored) return stored;

  // 2. Try env variable (Vite)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;

  // 3. Default to 127.0.0.1 (more reliable than 'localhost' in some WebViews)
  return 'http://127.0.0.1:3001';
};

export const api = hc<AppType>(getServerUrl(), {
  headers: async () => {
    const token = localStorage.getItem('smartlaw_token');
    return (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
  },
});
