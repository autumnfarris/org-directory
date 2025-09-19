# Automated Sync: page.js ↔ index.html

This project includes automated tools to keep your `index.html` (for Google Apps Script) in sync with changes made to `src/app/page.js` (React/Next.js).

## Quick Start

### Option 1: One-time Sync
```bash
npm run sync-html
```
This will immediately sync any changes from `page.js` to `index.html`.

### Option 2: Automatic Watching (Recommended)
```bash
npm run watch-sync
```
This starts a file watcher that automatically syncs `page.js` changes to `index.html` whenever you save the file. Press `Ctrl+C` to stop.

## How It Works

The automation extracts these key parts from your React component:
- `organizeEmployeeData` function
- `getEmploymentStatus` function
- `isManager` function
- Employee list rendering logic

It then updates the corresponding JavaScript functions in `index.html` to match your React component's logic.

## Development Workflow

1. **Start the watcher**: Run `npm run watch-sync` in a terminal
2. **Edit React code**: Make changes to `src/app/page.js`
3. **Automatic sync**: Your changes are automatically applied to `index.html`
4. **Deploy to GAS**: Upload the updated `index.html` to your Google Apps Script project

## Files Created

- `sync-to-html.js` - Core conversion logic
- `watch-and-sync.js` - File watcher for automatic syncing
- `SYNC_README.md` - This documentation

## What Gets Synced

✅ **Synced automatically:**
- Data organization logic
- Employee sorting (managers first)
- Employment status detection
- Manager role identification
- Basic rendering structure

❌ **Not synced (HTML-specific):**
- HTML structure and styling
- Google Apps Script integration
- Event handlers
- CSS classes and styling

## Troubleshooting

If sync fails:
1. Check that `src/app/page.js` exists and has the expected function structure
2. Ensure `index.html` exists and has the target functions to replace
3. Run `npm run sync-html` manually to see detailed error messages

## Manual Sync

You can still manually sync by running the one-time sync command whenever needed:
```bash
npm run sync-html
```