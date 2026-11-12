/**
 * Where API requests go. In development Vite proxies `/api` to the backend
 * (BACKEND_URL, default http://localhost:3000); a deployment serves the API
 * at this path or sets VITE_API_URL to its address.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "/api";
