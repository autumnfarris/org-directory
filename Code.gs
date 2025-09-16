/**
 * Google Apps Script Web App for NMFS OCIO Organization Directory
 * This file contains the server-side Apps Script code
 */

function doGet(e) {
  const page = e.parameter.page || 'index';

  switch(page) {
    case 'index':
      return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('NMFS OCIO Directory')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    default:
      return HtmlService.createHtmlOutput('<h1>Page not found</h1>');
  }
}

/**
 * Include function to load CSS and JS files
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Fetch employee data from Google Sheets
 * This replaces the client-side axios call
 */
function getEmployeeData() {
  try {
    // Your Google Sheets CSV URL
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1f8f96GYNenNk4IGrnYlOcnAgoSrb0O7F6Uu1h_hXmujOMk9OgU5hCqerVT7OuIcLj4SlVqI39-DK/pub?output=csv";

    const response = UrlFetchApp.fetch(csvUrl, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'NMFS-OCIO-OrgChart/1.0'
      }
    });

    if (response.getResponseCode() !== 200) {
      console.log('Failed to fetch data, using fallback');
      return getFallbackData();
    }

    const csvData = response.getContentText();

    if (!csvData) {
      console.log('No CSV data received, using fallback data');
      return getFallbackData();
    }

    // Parse CSV data
    const rows = parseCsvData(csvData);

    if (!rows || rows.length === 0) {
      console.log('No data found in CSV, using fallback data');
      return getFallbackData();
    }

    const headers = rows[0];
    const employees = rows.slice(1).map(function(row) {
      const employee = {};
      headers.forEach(function(header, index) {
        const key = mapHeaderToKey(header.toUpperCase().trim());
        employee[key] = row[index] || null;
      });
      return employee;
    });

    console.log('Successfully loaded ' + employees.length + ' employees from Google Sheets');
    return employees;

  } catch (error) {
    console.error('Error fetching Google Sheets CSV data:', error);
    console.log('Falling back to local data');
    return getFallbackData();
  }
}

/**
 * Parse CSV data - handles quoted fields with commas
 */
function parseCsvData(csvText) {
  const lines = csvText.split('\n').filter(function(line) {
    return line.trim();
  });
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const row = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          j++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add the last field
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Map CSV headers to internal keys
 */
function mapHeaderToKey(header) {
  const headerMap = {
    'PERSON_ID': 'id',
    'LAST_NAME': 'lastName',
    'FIRST_NAME': 'firstName',
    'EMAIL_ADDRESS': 'email',
    'MGR_NAME': 'manager',
    'OFFICE': 'division',
    'DUMMY_POSITION_TITLE': 'title',
    'DUMMY_ORG_TITLE': 'positionDescription',
    'DUMMY_PROGRAM_TITLE': 'program',
    'EMPL_CODE': 'empl_code'
  };

  return headerMap[header] || header;
}

/**
 * Fallback employee data
 */
function getFallbackData() {
  return [
    {
      "id": "1",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "title": "Chief Information Officer",
      "division": "Information Technology",
      "program": null,
      "manager": null,
      "empl_code": "GS"
    },
    {
      "id": "2",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com",
      "title": "Deputy Chief Information Officer",
      "division": "Information Technology",
      "program": null,
      "manager": "John Doe",
      "empl_code": "GS"
    },
    {
      "id": "3",
      "firstName": "Bob",
      "lastName": "Johnson",
      "email": "bob.johnson@example.com",
      "title": "Director of Systems",
      "division": "Systems Division",
      "program": null,
      "manager": "John Doe",
      "empl_code": "CONTRACTOR"
    },
    {
      "id": "4",
      "firstName": "Alice",
      "lastName": "Brown",
      "email": "alice.brown@example.com",
      "title": "Software Developer",
      "division": "Systems Division",
      "program": "Development Program",
      "manager": "Bob Johnson",
      "empl_code": "GS"
    }
  ];
}

/**
 * Organize employee data into hierarchical structure
 */
function organizeEmployeeData(employees) {
  const cio = employees.find(function(emp) {
    return emp.title && emp.title.toLowerCase().includes('chief information officer') &&
           !emp.title.toLowerCase().includes('deputy');
  });

  const deputyCIOs = employees.filter(function(emp) {
    return emp.title && emp.title.toLowerCase().includes('deputy cio');
  });

  const divisions = {};

  employees.forEach(function(employee) {
    if (employee.division && employee.division.trim()) {
      let divisionName = employee.division.trim();

      // Extract value after CIO/ and before the second /
      if (divisionName.startsWith('CIO/')) {
        const parts = divisionName.split('/');
        if (parts.length >= 2) {
          // Remove trailing space from the division name after CIO/
          divisionName = parts[1].replace(/\s+$/, '');
        } else {
          divisionName = 'CIO';
        }
      }

      if (!divisions[divisionName]) {
        divisions[divisionName] = {
          name: divisionName,
          director: null,
          programs: {},
          employees: []
        };
      }

      if (employee.title && employee.title.toLowerCase().includes('director')) {
        divisions[divisionName].director = employee;
      }

      if (employee.program && employee.program.trim()) {
        const programName = employee.program.trim();

        if (!divisions[divisionName].programs[programName]) {
          divisions[divisionName].programs[programName] = {
            name: programName,
            lead: null,
            employees: []
          };
        }

        if (employee.title && employee.title.toLowerCase().includes('lead')) {
          divisions[divisionName].programs[programName].lead = employee;
        } else {
          divisions[divisionName].programs[programName].employees.push(employee);
        }
      } else {
        divisions[divisionName].employees.push(employee);
      }
    }
  });

  return {
    cio: cio,
    deputyCIOs: deputyCIOs,
    divisions: Object.keys(divisions).map(function(key) { return divisions[key]; }),
    allEmployees: employees
  };
}