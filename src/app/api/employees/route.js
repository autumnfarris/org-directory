import fallbackData from '../../../data/fallback-employees.json';
import axios from 'axios';

export async function GET() {
	try {
		const employees = await fetchEmployeeData();
		const organizedData = organizeEmployeeData(employees);

		return Response.json(organizedData);
	} catch (error) {
		console.error('Error fetching employee data:', error);
		return Response.json(
			{
				message: 'Error fetching employee data',
				error: error.message
			},
			{ status: 500 }
		);
	}
}

async function fetchEmployeeData() {
	const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1f8f96GYNenNk4IGrnYlOcnAgoSrb0O7F6Uu1h_hXmujOMk9OgU5hCqerVT7OuIcLj4SlVqI39-DK/pub?output=csv";

	try {
		console.log('Fetching data from Google Sheets CSV...');
		const response = await axios.get(csvUrl, {
			timeout: 10000, // 10 second timeout
			headers: {
				'User-Agent': 'NMFS-OCIO-OrgChart/1.0'
			}
		});

		const csvData = response.data;

		if (!csvData) {
			console.warn('No CSV data received, using fallback data');
			return fallbackData;
		}

		// Parse CSV data
		const rows = parseCsvData(csvData);

		if (!rows || rows.length === 0) {
			console.warn('No data found in CSV, using fallback data');
			return fallbackData;
		}

		const headers = rows[0];
		const employees = rows.slice(1).map(row => {
			const employee = {};
			headers.forEach((header, index) => {
				const key = mapHeaderToKey(header.toUpperCase().trim());
				employee[key] = row[index] || null;
			});
			return employee;
		});

		console.log(`Successfully loaded ${employees.length} employees from Google Sheets`);
		return employees;
	} catch (error) {
		console.error('Error fetching Google Sheets CSV data:', error);
		console.warn('Falling back to local data');
		return fallbackData;
	}
}

function parseCsvData(csvText) {
	const lines = csvText.split('\n').filter(line => line.trim());
	const rows = [];

	for (let line of lines) {
		// Simple CSV parsing - handles quoted fields with commas
		const row = [];
		let current = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			const nextChar = line[i + 1];

			if (char === '"' && !inQuotes) {
				inQuotes = true;
			} else if (char === '"' && inQuotes) {
				if (nextChar === '"') {
					// Escaped quote
					current += '"';
					i++; // skip next quote
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

function mapHeaderToKey(header) {
	// Map the new headers to your internal keys
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
		// Add more mappings if needed
	};

	return headerMap[header] || header;
}

function organizeEmployeeData(employees) {
	const cio = employees.find(emp =>
		emp.title && emp.title.toLowerCase().includes('chief information officer') &&
		!emp.title.toLowerCase().includes('deputy')
	);

	const deputyCIOs = employees.filter(emp =>
		emp.title && emp.title.toLowerCase().includes('deputy cio')
	);

	const divisions = {};

	employees.forEach(employee => {
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
		cio,
		deputyCIOs,
		divisions: Object.values(divisions),
		allEmployees: employees
	};
}
