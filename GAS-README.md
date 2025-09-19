# OCIO Organization Directory - Google Apps Script Deployment

This project contains the NOAA Office of the Chief Information Officer organization directory, converted from a React/Next.js application to run entirely within Google Apps Script.

## Overview

The application displays an interactive organization chart showing:
- Chief Information Officer and Deputy CIOs
- Division structure with directors
- Program organization within divisions
- Employee details with federal/contractor status
- Data fetching from Google Sheets CSV export

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (for clasp CLI tool)
2. **Google Apps Script CLI (clasp)** installed globally:
   ```bash
   npm install -g @google/clasp
   ```
3. **Google Account** with access to Google Apps Script
4. **Google Sheets** with your organization data (or use the fallback data)

## Setup Instructions

### 1. Enable Google Apps Script API

1. Go to [Google Apps Script Settings](https://script.google.com/home/usersettings)
2. Turn ON "Google Apps Script API"

### 2. Authenticate clasp with Google

```bash
clasp login
```

This will open a browser window to authenticate with your Google account.

### 3. Create a New Google Apps Script Project

```bash
clasp create --title "NOAA OCIO Directory" --type webapp
```

This command will:
- Create a new Apps Script project in your Google Drive
- Generate a script ID
- Update the `.clasp.json` file with the script ID

**Alternative: Manual Creation**
If you prefer to create the project manually:
1. Go to [Google Apps Script](https://script.google.com)
2. Click "New Project"
3. Name it "NOAA OCIO Directory"
4. Note the script ID from the URL (e.g., `https://script.google.com/d/YOUR_SCRIPT_ID/edit`)
5. Update `.clasp.json` with your script ID:
   ```json
   {
     "scriptId": "YOUR_SCRIPT_ID_HERE",
     "rootDir": "."
   }
   ```

### 4. Configure Google Sheets Data Source (Optional)

If you want to use live data from Google Sheets:

1. Create or use an existing Google Sheets document
2. Ensure it has the required columns:
   - `PERSON_ID`
   - `FIRST_NAME`
   - `LAST_NAME`
   - `EMAIL_ADDRESS`
   - `MGR_NAME`
   - `OFFICE`
   - `DUMMY_POSITION_TITLE`
   - `DUMMY_ORG_TITLE`
   - `DUMMY_PROGRAM_TITLE`
   - `EMPL_CODE`
3. Publish the sheet as CSV:
   - File → Share → Publish to web
   - Select "Comma-separated values (.csv)"
   - Copy the public URL
4. Update the CSV URL in `Code.gs` (line 64):
   ```javascript
   const csvUrl = "YOUR_GOOGLE_SHEETS_CSV_URL_HERE";
   ```

### 5. Deploy the Application

#### Upload the code to Google Apps Script:

```bash
clasp push
```

This uploads all files (Code.gs, index.html, appsscript.json) to your Apps Script project.

#### Deploy as a Web App:

```bash
clasp deploy --description "Initial deployment"
```

**Alternative: Manual Deployment**
1. Go to your Apps Script project in the browser
2. Click "Deploy" → "New Deployment"
3. Select type: "Web app"
4. Set execute as: "Me"
5. Set access: "Anyone" (or "Anyone with Google account" for restricted access)
6. Click "Deploy"

### 6. Access Your Application

After deployment, you'll receive a web app URL. The application will be accessible at:
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

## Project Structure

```
org-directory/
├── Code.gs              # Server-side Apps Script code
├── index.html           # Main HTML template with embedded CSS/JS
├── appsscript.json      # Apps Script project configuration
├── .clasp.json          # clasp configuration (contains script ID)
├── .claspignore         # Files to ignore during clasp push
└── GAS-README.md        # This file
```

### File Descriptions

- **Code.gs**: Contains all server-side logic including data fetching from Google Sheets, CSV parsing, and data organization
- **index.html**: Complete web application with HTML structure, CSS styling (Tailwind), and JavaScript functionality
- **appsscript.json**: Defines the Apps Script project settings, timezone, and web app permissions
- **.clasp.json**: Links the local project to your Google Apps Script project
- **.claspignore**: Excludes unnecessary files from being uploaded to Apps Script

## Development Workflow

### Making Changes

1. **Edit the code locally** in your preferred editor
2. **Push changes** to Google Apps Script:
   ```bash
   clasp push
   ```
3. **Deploy updates** (creates a new version):
   ```bash
   clasp deploy --description "Description of changes"
   ```

### Version Management

- Each deployment creates a new version
- You can manage versions in the Apps Script editor under "Deploy" → "Manage deployments"
- Test versions before updating the main deployment

### Debugging

1. **View logs** in the Apps Script editor:
   ```bash
   clasp logs
   ```
2. **Open the project** in browser for debugging:
   ```bash
   clasp open
   ```

## Configuration Options

### Timezone
Update timezone in `appsscript.json`:
```json
{
  "timeZone": "America/New_York"
}
```

### Access Control
Modify access permissions in `appsscript.json`:
```json
{
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"  // or "ANYONE" or "DOMAIN"
  }
}
```

### Styling Customization
The application uses Tailwind CSS via CDN. Custom styles can be added to the `<style>` section in `index.html`.

Colors can be customized in the Tailwind config:
```javascript
tailwind.config = {
    theme: {
        extend: {
            colors: {
                'nmfs-blue': '#003185',      // Primary blue
                'nmfs-light-blue': '#0085ca' // Secondary blue
            }
        }
    }
}
```

## Data Structure

The application expects employee data with the following structure:

```javascript
{
  id: "unique_id",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  title: "Position Title",
  division: "Division Name",
  program: "Program Name", // optional
  manager: "Manager Name", // optional
  empl_code: "GS" // or "CONTRACTOR"
}
```

### Division Filtering
The application automatically filters out divisions named:
- CIO
- DDCIO1
- DDCIO2

### Employee Status Detection
Federal vs Contractor status is determined by the `empl_code` field:
- **Federal**: Contains "GS", "FED", or "FEDERAL"
- **Contractor**: Any other value

## Limitations & Considerations

### Google Apps Script Limitations

1. **Execution Time**: Maximum 6 minutes per execution
2. **Memory**: 100MB heap size limit
3. **Network Requests**: Limited to 20,000 requests per day
4. **File Size**: Each file limited to 50MB
5. **Project Size**: Total project limited to 50MB

### Performance Considerations

1. **Data Caching**: Consider implementing caching for frequently accessed data
2. **Large Datasets**: For >1000 employees, consider pagination or lazy loading
3. **API Calls**: Minimize external API calls; Google Sheets integration is optimized

### Security Considerations

1. **Data Exposure**: Be mindful of sensitive employee information
2. **Access Control**: Configure appropriate access levels
3. **HTTPS**: Apps Script web apps are automatically served over HTTPS
4. **Authentication**: Consider requiring Google authentication for internal use

## Troubleshooting

### Common Issues

1. **"Script not found" Error**
   - Verify script ID in `.clasp.json`
   - Ensure you have access to the Apps Script project

2. **Permission Denied**
   - Check Apps Script API is enabled
   - Re-run `clasp login`

3. **Deployment Fails**
   - Ensure all files are properly formatted
   - Check for JavaScript syntax errors
   - Verify appsscript.json is valid JSON

4. **Data Not Loading**
   - Check Google Sheets CSV URL is public
   - Verify CSV format matches expected columns
   - Check browser console for JavaScript errors

5. **Styling Issues**
   - Ensure Tailwind CSS CDN is loading
   - Check for CSS conflicts
   - Verify browser compatibility

### Getting Help

1. **Apps Script Documentation**: https://developers.google.com/apps-script
2. **clasp Documentation**: https://github.com/google/clasp
3. **Google Apps Script Community**: https://stackoverflow.com/questions/tagged/google-apps-script

## Migration Notes

This application was converted from a React/Next.js application with the following changes:

### React → Vanilla JavaScript
- Component state managed with global variables
- React hooks replaced with traditional event handling
- JSX converted to template literals with HTML strings

### Next.js → Google Apps Script
- Static export removed (no longer needed)
- API routes moved to server-side Apps Script functions
- Client-side routing replaced with single-page application

### Dependencies
- **Removed**: React, Next.js, Axios, Node dependencies
- **Added**: Tailwind CSS via CDN
- **Replaced**: Axios with Google Apps Script UrlFetchApp

### Data Fetching
- Moved from client-side to server-side (Code.gs)
- Direct Google Sheets integration instead of CSV parsing in browser
- Fallback data embedded in server code

This conversion maintains all original functionality while making the application completely self-contained within Google Apps Script.