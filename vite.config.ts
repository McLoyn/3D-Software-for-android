import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' membuat hasil build bisa dibuka dari path relatif (dibutuhkan Capacitor).
// server.host true membuat dev server bisa diakses dari tablet lewat jaringan Wi-Fi yang sama.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true, port: 5173 },
});
