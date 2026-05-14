import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/routes';

const getServerUrl = () => {
  // Check localStorage first (allows runtime overrides in settings)
  const savedUrl = localStorage.getItem('smartlaw_server_url');
  if (savedUrl) return savedUrl.trim();

  // Then check environment variables
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.trim();

  // Default to local in dev, remote in prod
  return import.meta.env.DEV 
    ? 'http://localhost:3001' 
    : 'https://smartlaw-api.rubenspg.com';
};

export const api = hc<AppType>(getServerUrl(), {
  headers: async () => {
    const token = localStorage.getItem('smartlaw_token');
    return (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
  },
});
