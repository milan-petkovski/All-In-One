import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    minify: true,
    cssMinify: true,
    reportCompressedSize: false,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        404: resolve(import.meta.dirname, '404.html'),
        azurirano: resolve(import.meta.dirname, 'azurirano.html'),
        hvala: resolve(import.meta.dirname, 'hvala.html'),
        obrisano: resolve(import.meta.dirname, 'obrisano.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
