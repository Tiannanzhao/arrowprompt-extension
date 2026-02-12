import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, renameSync, rmSync, readFileSync, writeFileSync } from 'fs';

// Plugin to copy manifest and icons after build
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      // Copy manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json');
      
      // Move popup HTML from dist/src/popup/ to dist/popup/
      const srcHtml = 'dist/src/popup/index.html';
      const destHtml = 'dist/popup/index.html';
      if (existsSync(srcHtml)) {
        // Read and update HTML to fix paths for Chrome extension
        // Original paths are relative from dist/src/popup/ (e.g., ../../popup/popup.js)
        // Target paths should be relative from dist/popup/
        let html = readFileSync(srcHtml, 'utf-8');
        // ../../popup/popup.js -> ./popup.js (from dist/popup/)
        html = html.replace(/\.\.\/\.\.\/popup\//g, './');
        // ../../chunks/ -> ../chunks/ (from dist/popup/)
        html = html.replace(/\.\.\/\.\.\/chunks\//g, '../chunks/');
        writeFileSync(destHtml, html);
        // Clean up src directory
        rmSync('dist/src', { recursive: true, force: true });
      }
      
      // Copy icons if they exist
      const iconsDir = 'public/icons';
      const distIconsDir = 'dist/icons';
      if (!existsSync(distIconsDir)) {
        mkdirSync(distIconsDir, { recursive: true });
      }
      if (existsSync(iconsDir)) {
        const files = readdirSync(iconsDir);
        files.forEach(file => {
          if (file.endsWith('.png')) {
            copyFileSync(`${iconsDir}/${file}`, `${distIconsDir}/${file}`);
          }
        });
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  base: './',
  build: {
    outDir: 'dist',
    emptyDirFirst: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        content: resolve(__dirname, 'src/content/content.ts'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'popup') {
            return 'popup/popup.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content/content.js';
          }
          if (chunkInfo.name === 'background') {
            return 'background/service-worker.js';
          }
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'popup/popup.css';
          }
          return 'assets/[name].[ext]';
        }
      }
    }
  }
});
