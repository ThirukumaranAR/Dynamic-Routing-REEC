import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            const isConnRefused =
              (err as any)?.code === 'ECONNREFUSED' ||
              (err as any)?.name === 'AggregateError' ||
              err?.message?.includes('ECONNREFUSED');
            if (isConnRefused && res && 'writeHead' in res && !(res as any).headersSent) {
              (res as any).writeHead(503, { 'Content-Type': 'application/json' });
              (res as any).end(JSON.stringify({ success: false, message: 'Backend service is starting up. Please retry shortly.' }));
            }
          });
        }
      }
    }
  }
});
