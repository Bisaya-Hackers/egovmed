import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api → the eGovMed backend so the browser can call it without CORS friction.
// Override the backend target with VITE_API_PROXY (e.g. http://localhost:4000).
export default defineConfig(() => {
  const target = process.env.VITE_API_PROXY || 'http://localhost:4000';
  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: { '/api': { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } },
    },
  };
});
