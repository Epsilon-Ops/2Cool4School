import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' permet de déployer sur GitHub Pages sans configuration supplémentaire
export default defineConfig({
  plugins: [react()],
  base: './',
});
