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
 * Fetch employee data directly from Google Sheets using SpreadsheetApp
 * This replaces the CSV URL approach with direct sheet access
 */
function getEmployeeData() {
  try {
    // Your Google Sheets ID
    const spreadsheetId = '19Muqry8NxRA6tI9VYxuf6z7vBzSS2H9RODsMhBV7neM';

    // Open the spreadsheet by ID
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    // Get the first sheet (or specify sheet name if needed)
    const sheet = spreadsheet.getActiveSheet();

    // Get all data from the sheet
    const data = sheet.getDataRange().getValues();

    if (!data || data.length === 0) {
      console.log('No data found in sheet, using fallback data');
      return getFallbackData();
    }

    // First row contains headers
    const headers = data[0];
    const rows = data.slice(1);

    // Convert rows to employee objects
    const employees = rows.map(function(row) {
      const employee = {};
      headers.forEach(function(header, index) {
        const key = mapHeaderToKey(header.toString().toUpperCase().trim());
        employee[key] = row[index] ? row[index].toString().trim() : null;
      });
      return employee;
    }).filter(function(employee) {
      // Filter out empty rows
      return employee.firstName || employee.lastName || employee.email;
    });

    console.log('Successfully loaded ' + employees.length + ' employees from Google Sheets');
    return employees;

  } catch (error) {
    console.error('Error accessing Google Sheets data:', error);
    console.log('Falling back to local data');
    return getFallbackData();
  }
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