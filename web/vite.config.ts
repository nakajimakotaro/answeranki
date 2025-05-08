import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // Alias '@' should now resolve relative to the 'web' directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: { // Move proxy under server
    proxy: {
      // Proxy API requests to the Node.js server during development
      '/api': {
        target: 'http://localhost:3000', // Your Node.js server address
        changeOrigin: true,
      },
      // Proxy media server requests
      '/media': {
        target: 'http://localhost:3000', // Media server address (same as API server)
        changeOrigin: true,
      },
      // Proxy tRPC requests
      '/trpc': {
        target: 'http://localhost:3000', // tRPC server address (same as API server)
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('react-router-dom')) {
              return 'vendor-router';
            }
            return 'vendor'; // その他のnode_modules
          }
        },
      },
    },
  },
});
