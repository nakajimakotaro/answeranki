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
      // Keep aliases for other workspaces if needed, relative to the root
      // These might not be strictly necessary if tsconfig-paths handles them
      // '@server': path.resolve(__dirname, '../server/src'),
      // '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    proxy: {
      // Proxy API requests to the Node.js server during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy media server requests
      '/media': {
        target: 'http://localhost:3000', // Point to the main server where media routes are handled
        changeOrigin: true,
      },
      // Proxy tRPC requests
      '/trpc': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    }
  }
})
