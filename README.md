# ArrowPrompt - AI Coding Shortcuts

A Chrome extension that sends AI prompts with arrow keys.

## Features

- ↑ key: Explain this code
- ↓ key: Optimize this
- ← key: Fix this bug
- → key: Translate to Chinese

## Supported Sites

- Claude.ai
- ChatGPT
- Gemini

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch
```

## Install in Chrome

1. Run `npm run build`
2. Open Chrome extensions page `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Project Structure

```
src/
├── background/     # Background service worker
├── content/        # Content script (injected into pages)
├── popup/          # Popup UI (React)
└── utils/          # Utility functions
```

## Icons

Add icon files to `public/icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## Tech Stack

- React + TypeScript
- Vite
- Chrome Extension Manifest V3
