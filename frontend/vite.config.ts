import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {rollupOptions:{input:{main:path.resolve(__dirname,'index.html'),hardware:path.resolve(__dirname,'pc-lab-viewer.html')}}},
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
});
