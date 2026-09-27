/**
 * All API calls go to the same origin. `ng serve` proxies /api to the local
 * backend (proxy.conf.json); in Docker, nginx proxies it to API_UPSTREAM.
 */
export const API_BASE_URL = '/api';
