import { defineConfig, build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'fs';

// Build content script and background as separate IIFE bundles
async function buildContentScripts() {
  // Build content script
  await build({
    configFile: false,
    build: {
      emptyOutDir: false,
      outDir: 'dist',
      lib: {
        entry: resolve(__dirname, 'src/content/content.ts'),
        name: 'ArrowPromptContent',
        formats: ['iife'],
        fileName: () => 'content/content.js'
      },
      rollupOptions: {
        output: {
          extend: true
        }
      }
    }
  });

  // Build background script
  await build({
    configFile: false,
    build: {
      emptyOutDir: false,
      outDir: 'dist',
      lib: {
        entry: resolve(__dirname, 'src/background/service-worker.ts'),
        name: 'ArrowPromptBackground',
        formats: ['iife'],
        fileName: () => 'background/service-worker.js'
      },
      rollupOptions: {
        output: {
          extend: true
        }
      }
    }
  });
}

// Plugin to copy manifest and icons after build
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    async closeBundle() {
      // Build content scripts as IIFE
      await buildContentScripts();
      
      // Copy manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json');
      
      // Move popup HTML from dist/src/popup/ to dist/popup/
      const srcHtml = 'dist/src/popup/index.html';
      const destHtml = 'dist/popup/index.html';
      if (existsSync(srcHtml)) {
        let html = readFileSync(srcHtml, 'utf-8');
        html = html.replace(/\.\.\/\.\.\/popup\//g, './');
        html = html.replace(/\.\.\/\.\.\/chunks\//g, '../chunks/');
        writeFileSync(destHtml, html);
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
      },
      output: {
        entryFileNames: 'popup/popup.js',
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
