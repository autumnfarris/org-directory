#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Converts React page.js component to vanilla HTML/JS for Google Apps Script
 */
class ReactToHtmlConverter {
    constructor() {
        this.pageJsPath = './src/app/page.js';
        this.indexHtmlPath = './index.html';
    }

    /**
     * Extract the organizeEmployeeData function from page.js
     */
    extractOrganizeEmployeeData(content) {
        const functionMatch = content.match(/const organizeEmployeeData = \(employees\) => \{[\s\S]*?\n\t\};/);
        if (!functionMatch) {
            throw new Error('Could not find organizeEmployeeData function in page.js');
        }

        // Convert arrow function to regular function and adjust formatting
        let func = functionMatch[0]
            .replace('const organizeEmployeeData = (employees) => {', 'function organizeEmployeeData(employees) {')
            .replace(/\t/g, '                '); // Convert tabs to spaces for HTML indentation

        return func;
    }

    /**
     * Extract utility functions from page.js
     */
    extractUtilityFunctions(content) {
        const functions = [];

        // Extract getEmploymentStatus
        const getEmploymentMatch = content.match(/const getEmploymentStatus = \(employee\) => \{[\s\S]*?\n\t\};/);
        if (getEmploymentMatch) {
            functions.push(getEmploymentMatch[0]
                .replace('const getEmploymentStatus = (employee) => {', 'function getEmploymentStatus(employee) {')
                .replace(/\t/g, '        '));
        }

        // Extract isManager
        const isManagerMatch = content.match(/const isManager = \(employee\) => \{[\s\S]*?\n\t\};/);
        if (isManagerMatch) {
            functions.push(isManagerMatch[0]
                .replace('const isManager = (employee) => {', 'function isManager(employee) {')
                .replace(/\t/g, '        '));
        }

        return functions.join('\n\n        ');
    }

    /**
     * Extract the main rendering logic from the React component
     */
    extractRenderingLogic(content) {
        // Extract the employee list rendering logic
        const employeeListMatch = content.match(/\{orgData\.divisions\[activeDivision\]\.employees\.map\(\(employee, eIndex\) => \{[\s\S]*?\}\)\}/);
        if (!employeeListMatch) {
            throw new Error('Could not find employee list rendering logic');
        }

        // Convert JSX to HTML string
        let renderLogic = employeeListMatch[0]
            .replace(/\{orgData\.divisions\[activeDivision\]\.employees\.map\(\(employee, eIndex\) => \{/, '')
            .replace(/\}\)\}$/, '')
            .replace(/className=/g, 'class=')
            .replace(/\{([^}]+)\}/g, '${$1}')
            .replace(/\n\t\t\t\t\t\t\t/g, '\n                    ');

        return `division.employees.map(employee => {
                        const employmentStatus = getEmploymentStatus(employee);
                        const employeeIsManager = isManager(employee);

                        return \`<div class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                            <div class="flex items-center gap-3">
                                <span class="text-gray-800 font-medium">
                                    \${employee.firstName} \${employee.lastName}
                                </span>
                                \${employeeIsManager ?
                                    \`<span class="px-2 py-1 text-xs rounded-full font-medium bg-blue-100 text-blue-800">
                                        Manager
                                    </span>\` : ''
                                }
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-1 text-xs rounded-full font-medium \${
                                    employmentStatus === 'federal'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                }">
                                    \${employmentStatus === 'federal' ? 'Federal' : 'Contractor'}
                                </span>
                            </div>
                        </div>\`;
                    }).join('')`;
    }

    /**
     * Read and update the HTML template
     */
    updateHtml() {
        try {
            console.log('Reading page.js...');
            const pageJsContent = fs.readFileSync(this.pageJsPath, 'utf8');

            console.log('Reading index.html...');
            const htmlContent = fs.readFileSync(this.indexHtmlPath, 'utf8');

            console.log('Extracting functions from page.js...');
            const organizeEmployeeData = this.extractOrganizeEmployeeData(pageJsContent);
            const utilityFunctions = this.extractUtilityFunctions(pageJsContent);

            // Update the HTML content
            let updatedHtml = htmlContent;

            // Replace organizeEmployeeData function
            updatedHtml = updatedHtml.replace(
                /function organizeEmployeeData\(employees\) \{[\s\S]*?\n        \}/,
                organizeEmployeeData
            );

            // Replace utility functions
            updatedHtml = updatedHtml.replace(
                /function getEmploymentStatus\(employee\) \{[\s\S]*?\n        \}/,
                utilityFunctions.split('\n\n        ')[0]
            );

            updatedHtml = updatedHtml.replace(
                /function isManager\(employee\) \{[\s\S]*?\n        \}/,
                utilityFunctions.split('\n\n        ')[1] || 'function isManager(employee) {\n            return employee.title && (\n                employee.title.toLowerCase().includes(\'director\') ||\n                employee.title.toLowerCase().includes(\'manager\') ||\n                employee.title.toLowerCase().includes(\'lead\') ||\n                employee.title.toLowerCase().includes(\'chief\') ||\n                employee.title.toLowerCase().includes(\'deputy\')\n            );\n        }'
            );

            console.log('Writing updated index.html...');
            fs.writeFileSync(this.indexHtmlPath, updatedHtml);

            console.log('✅ Successfully synced page.js changes to index.html');

        } catch (error) {
            console.error('❌ Error syncing files:', error.message);
            process.exit(1);
        }
    }
}

// Run the converter
if (require.main === module) {
    const converter = new ReactToHtmlConverter();
    converter.updateHtml();
}

module.exports = ReactToHtmlConverter;