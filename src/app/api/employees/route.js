import { NextResponse } from 'next/server';
import fallbackData from '../../../data/fallback-employees.json';

// Environment detection
const isLocalDevelopment = process.env.NODE_ENV === 'development';
const isGAS = typeof google !== 'undefined' && google.script;

// Google Sheets published CSV URL
const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS1f8f96GYNenNk4IGrnYlOcnAgoSrb0O7F6Uu1h_hXmujOMk9OgU5hCqerVT7OuIcLj4SlVqI39-DK/pub?output=csv";

// Parse CSV text to rows (handles quoted fields with commas)
function parseCsvData(csvText) {
	const lines = csvText.trim().split('\n');
	return lines.map(line => {
		const row = [];
		let currentField = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			if (char === '"' && (i === 0 || line[i-1] === ',')) {
				inQuotes = true;
			} else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
				inQuotes = false;
			} else if (char === ',' && !inQuotes) {
				row.push(currentField.trim());
				currentField = '';
			} else {
				currentField += char;
			}
		}
		row.push(currentField.trim());
		return row;
	});
}

// Map CSV headers to internal keys
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
	return headerMap[header] || header.toLowerCase();
}

// Fetch data from Google Sheets CSV
async function fetchFromGoogleSheets() {
	try {
		console.log('Fetching data from Google Sheets CSV...');
		console.log('CSV URL:', GOOGLE_SHEETS_CSV_URL);

		const response = await fetch(GOOGLE_SHEETS_CSV_URL, {
			headers: {
				'User-Agent': 'NMFS-OCIO-OrgChart/1.0'
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const csvData = await response.text();

		if (!csvData) {
			console.warn('No CSV data received, using fallback data');
			return fallbackData;
		}

		console.log('CSV data length:', csvData.length);
		console.log('CSV preview:', csvData.substring(0, 200) + '...');

		// Parse CSV data
		const rows = parseCsvData(csvData);

		if (!rows || rows.length === 0) {
			console.warn('No data found in CSV, using fallback data');
			return fallbackData;
		}

		const headers = rows[0];
		console.log('CSV headers:', headers);

		const employees = rows.slice(1).map(row => {
			const employee = {};
			headers.forEach((header, index) => {
				const key = mapHeaderToKey(header.toUpperCase().trim());
				employee[key] = row[index] ? row[index].trim() : null;
			});
			return employee;
		}).filter(employee => {
			// Filter out empty rows
			return employee.firstName || employee.lastName || employee.email;
		});

		console.log(`Successfully loaded ${employees.length} employees from Google Sheets`);
		return employees;
	} catch (error) {
		console.error('Error fetching Google Sheets CSV data:', error);
		console.warn('Falling back to local data');
		return fallbackData;
	}
}

// Fetch data from Google Apps Script backend (for GAS deployment)
async function fetchFromGASBackend() {
	try {
		console.log('Fetching data from Google Apps Script backend...');
		// This function would be called when deployed in Google Apps Script environment
		// The actual implementation depends on how your GAS backend is set up

		// Example GAS backend call (uncomment and modify as needed):
		// const backendUrl = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=getEmployees';
		// const response = await fetch(backendUrl);
		// return await response.json();

		// For now, return fallback data when in GAS environment
		console.log('GAS backend not configured - using fallback data');
		return fallbackData;
	} catch (error) {
		console.error('Error fetching from GAS backend:', error);
		return fallbackData;
	}
}

// Main data fetching function with environment detection
async function fetchEmployeeData() {
	try {
		if (isLocalDevelopment) {
			// Local development: fetch from Google Sheets CSV
			return await fetchFromGoogleSheets();
		} else if (isGAS) {
			// Google Apps Script environment: use GAS backend
			return await fetchFromGASBackend();
		} else {
			// Production/other environments: fallback to local data
			console.log('Environment not detected, using fallback data');
			return fallbackData;
		}
	} catch (error) {
		console.error('Error in fetchEmployeeData:', error);
		return fallbackData;
	}
}

export async function GET() {
	try {
		console.log('API GET request received');
		console.log('Environment:', {
			NODE_ENV: process.env.NODE_ENV,
			isLocalDevelopment,
			isGAS: typeof google !== 'undefined' && google?.script
		});

		const employees = await fetchEmployeeData();

		if (!employees || !Array.isArray(employees)) {
			console.warn('Invalid employee data received, using fallback');
			return NextResponse.json(fallbackData);
		}

		console.log(`API returning ${employees.length} employees`);
		return NextResponse.json(employees);
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json(fallbackData, { status: 500 });
	}
}