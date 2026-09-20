import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import { buildSync } from 'esbuild';

/**
 * Custom Vite plugin to bundle background service worker,
 * content script, and copy extension assets into dist
 */
function chromeExtensionPlugin(): Plugin {
  return {
    name: 'chrome-extension-plugin',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      console.log('⚡ Bundling Chrome Extension background & content scripts...');

      // 1. Bundle Background Service Worker (ESM)
      buildSync({
        entryPoints: [resolve(__dirname, 'src/background/index.ts')],
        bundle: true,
        outfile: resolve(outDir, 'background.js'),
        format: 'esm',
        target: 'es2022',
        platform: 'browser',
        minify: false,
      });

      // 2. Bundle Content Script (IIFE, self-contained for Chrome compatibility)
      buildSync({
        entryPoints: [resolve(__dirname, 'src/content/index.ts')],
        bundle: true,
        outfile: resolve(outDir, 'content.js'),
        format: 'iife',
        target: 'es2022',
        platform: 'browser',
        minify: false,
      });

      // 3. Copy manifest.json to dist
      fs.copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(outDir, 'manifest.json')
      );

      // 4. Copy assets/icons to dist/assets/icons
      const iconsDistDir = resolve(outDir, 'assets/icons');
      if (!fs.existsSync(iconsDistDir)) {
        fs.mkdirSync(iconsDistDir, { recursive: true });
      }

      const iconFiles = ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png', 'icon.svg'];
      for (const icon of iconFiles) {
        const srcIcon = resolve(__dirname, 'assets/icons', icon);
        if (fs.existsSync(srcIcon)) {
          fs.copyFileSync(srcIcon, resolve(iconsDistDir, icon));
        }
      }

      console.log('✅ Chrome Extension build finalized successfully in dist/');
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), chromeExtensionPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: '/src/sidepanel/index.html',
  },
});
