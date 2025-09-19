# Environment Setup Guide

This application supports two deployment environments with automatic environment detection:

## 🖥️ Local Development (Next.js)

### Data Source: Google Drive
When running `npm run dev`, the application automatically fetches data from:
- **Google Drive File ID**: `1rEpNKfkAvy77h8Ehh3JKcazGVRLJHQM_`
- **Direct Download URL**: `https://drive.google.com/uc?export=download&id=1rEpNKfkAvy77h8Ehh3JKcazGVRLJHQM_`

### How to Run:
```bash
npm install
npm run dev
```

### Environment Detection:
- Detects `process.env.NODE_ENV === 'development'`
- Uses Next.js API route: `/api/employees`
- Fetches from Google Drive automatically
- Falls back to local fallback data if Google Drive fails

---

## ☁️ Google Apps Script Deployment

### Data Source: Google Sheets
When deployed to Google Apps Script, the application uses:
- **Google Sheets ID**: `19Muqry8NxRA6tI9VYxuf6z7vBzSS2H9RODsMhBV7neM`
- **Direct SpreadsheetApp access**
- **File**: `index.html` (not React components)

### How it Works:
- Detects `typeof google !== 'undefined' && google.script`
- Calls `google.script.run.getEmployeeData()` directly
- Uses Google Apps Script's `SpreadsheetApp` to read data
- Processes data server-side in Apps Script environment

---

## 🔧 Environment Detection Logic

### Frontend (React - page.js):
```javascript
const isGAS = typeof google !== 'undefined' && google.script;
const isLocalDev = process.env.NODE_ENV === 'development';

if (isGAS) {
    // Use google.script.run.getEmployeeData()
} else {
    // Use axios.get('/api/employees')
}
```

### Backend API (route.js):
```javascript
const isLocalDevelopment = process.env.NODE_ENV === 'development';
const isGAS = typeof google !== 'undefined' && google.script;

if (isLocalDevelopment) {
    // Fetch from Google Drive
} else if (isGAS) {
    // Use GAS backend functions
} else {
    // Use fallback data
}
```

---

## 📊 Data Flow

### Local Development:
```
React Component (page.js)
    → Next.js API (/api/employees)
    → Google Drive File
    → JSON Data
```

### GAS Deployment:
```
HTML/Vanilla JS (index.html)
    → google.script.run.getEmployeeData()
    → Google Sheets (SpreadsheetApp)
    → JSON Data
```

---

## 🐛 Troubleshooting

### Local Development Issues:
1. **Google Drive Access**: The file needs to be publicly shared without authentication
   - **Current Status**: File requires Google authentication (returns HTML login page)
   - **Solution Options**:
     - Make the Google Drive file public with "Anyone with the link can view"
     - OR: Use a different file hosting service (GitHub raw, etc.)
     - OR: Use Google Drive API with proper authentication
   - **Current Behavior**: Falls back to local fallback data (working as designed)

2. **CORS Issues**: The API route handles CORS for Google Drive requests
3. **Fallback Data**: Check console for fallback usage warnings - this is normal for private files

### GAS Deployment Issues:
1. **Sheet Access**: Ensure the script has permission to access the Google Sheet
2. **File Permissions**: Make sure `index.html` is included in the GAS project
3. **Console Logs**: Check Google Apps Script editor logs

---

## ⚙️ Configuration Files

- `.env.local`: Local environment variables
- `Code.gs`: Google Apps Script server-side functions
- `src/app/api/employees/route.js`: Next.js API route with environment detection
- `src/app/page.js`: React component with dual environment support
- `index.html`: GAS-compatible HTML file

---

## 🚀 Testing Both Environments

### Test Local Development:
```bash
npm run dev
# Check browser console for "Fetching data from Next.js API..."
# Should see Google Drive fetch logs
```

### Test GAS Deployment:
1. Deploy to Google Apps Script
2. Access the web app URL
3. Check for "Fetching data from Google Apps Script backend..." in console
4. Verify Google Sheets data loading

Both environments automatically handle errors and fall back to local fallback data when needed.