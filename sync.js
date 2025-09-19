#!/usr/bin/env node

/**
 * Resilient Code Refactorer & Generator
 *
 * Converts React/Next.js page.js file into static index.html for Google Apps Script hosting
 * Uses AST parsing instead of brittle regex for robust extraction and syncing
 *
 * Usage: node sync.js
 */

const fs = require('fs');
const path = require('path');
const babel = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

class ReactExtractor {
    constructor() {
        this.extractedFunctions = new Map();
        this.extractedState = [];
        this.extractedLogic = [];
        this.warnings = [];
    }

    /**
     * Parse React component file and extract relevant code
     */
    async extractFromReact(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const ast = babel.parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });

            this.traverseAST(ast);
            return this.buildExtractionResult();
        } catch (error) {
            throw new Error(`Failed to parse React file: ${error.message}`);
        }
    }

    /**
     * Traverse AST and extract functions, state, and logic
     */
    traverseAST(ast) {
        traverse(ast, {
            // Extract function declarations and arrow functions
            FunctionDeclaration: (path) => {
                this.extractFunction(path);
            },

            VariableDeclarator: (path) => {
                // Extract arrow functions assigned to variables
                if (path.node.init &&
                    (path.node.init.type === 'ArrowFunctionExpression' ||
                     path.node.init.type === 'FunctionExpression')) {
                    this.extractArrowFunction(path);
                }

                // Extract useState calls
                if (this.isUseStateCall(path.node.init)) {
                    this.extractState(path);
                }
            },

            // Extract useEffect and other hooks
            CallExpression: (path) => {
                if (this.isUseEffectCall(path.node)) {
                    this.extractUseEffect(path);
                }

                if (this.isUseCallbackCall(path.node)) {
                    this.extractUseCallback(path);
                }
            }
        });
    }

    /**
     * Extract regular function declarations
     */
    extractFunction(path) {
        const functionName = path.node.id?.name;
        if (functionName && this.isTargetFunction(functionName)) {
            const code = this.convertToVanillaJS(path);
            this.extractedFunctions.set(functionName, {
                code,
                type: 'function',
                params: path.node.params.map(p => p.name || 'param'),
                originalPath: path
            });
            console.log(`✓ Extracted function: ${functionName}`);
        }
    }

    /**
     * Extract arrow functions
     */
    extractArrowFunction(path) {
        const functionName = path.node.id?.name;
        if (functionName && this.isTargetFunction(functionName)) {
            const code = this.convertArrowToVanillaJS(path);
            this.extractedFunctions.set(functionName, {
                code,
                type: 'arrow',
                params: path.node.init.params.map(p => p.name || 'param'),
                originalPath: path
            });
            console.log(`✓ Extracted arrow function: ${functionName}`);
        }
    }

    /**
     * Extract useState declarations
     */
    extractState(path) {
        const stateVar = path.node.id;
        if (stateVar.type === 'ArrayPattern' && stateVar.elements.length === 2) {
            const [getter, setter] = stateVar.elements;
            const initialValue = this.extractInitialValue(path.node.init.arguments?.[0]);

            this.extractedState.push({
                getter: getter.name,
                setter: setter.name,
                initialValue,
                jsEquivalent: this.convertStateToVanilla(getter.name, setter.name, initialValue)
            });
            console.log(`✓ Extracted state: ${getter.name}`);
        }
    }

    /**
     * Extract useEffect logic
     */
    extractUseEffect(path) {
        const effectFunction = path.node.arguments[0];
        if (effectFunction) {
            const code = this.convertEffectToVanilla(effectFunction);
            this.extractedLogic.push({
                type: 'effect',
                code,
                dependencies: this.extractEffectDependencies(path.node.arguments[1])
            });
            console.log(`✓ Extracted useEffect logic`);
        }
    }

    /**
     * Extract useCallback logic
     */
    extractUseCallback(path) {
        // Find parent variable declarator to get function name
        let parent = path.parent;
        while (parent && parent.type !== 'VariableDeclarator') {
            parent = path.parentPath?.parent;
            if (!parent) break;
        }

        if (parent?.id?.name && this.isTargetFunction(parent.id.name)) {
            const functionName = parent.id.name;
            const callbackFunction = path.node.arguments[0];
            const code = this.convertCallbackToVanilla(callbackFunction, functionName);

            this.extractedFunctions.set(functionName, {
                code,
                type: 'callback',
                params: callbackFunction.params?.map(p => p.name || 'param') || [],
                originalPath: path
            });
            console.log(`✓ Extracted useCallback: ${functionName}`);
        }
    }

    /**
     * Check if this is a function we want to extract
     */
    isTargetFunction(name) {
        const targetFunctions = [
            'organizeEmployeeData',
            'getEmploymentStatus',
            'isManager',
            'fetchEmployeeData',
            'loadData'
        ];
        return targetFunctions.includes(name);
    }

    /**
     * Convert React function to vanilla JS
     */
    convertToVanillaJS(path) {
        const code = generate(path.node).code;
        return this.cleanReactSyntax(code);
    }

    /**
     * Convert arrow function to vanilla JS
     */
    convertArrowToVanillaJS(path) {
        const arrowFunc = path.node.init;
        const functionName = path.node.id.name;

        // Convert arrow function to regular function
        const params = arrowFunc.params.map(p => p.name || 'param').join(', ');
        const bodyCode = arrowFunc.body.type === 'BlockStatement'
            ? generate(arrowFunc.body).code
            : `{ return ${generate(arrowFunc.body).code}; }`;

        const functionCode = `function ${functionName}(${params}) ${bodyCode}`;
        return this.cleanReactSyntax(functionCode);
    }

    /**
     * Convert useCallback to vanilla JS
     */
    convertCallbackToVanilla(callbackNode, functionName) {
        const params = callbackNode.params?.map(p => p.name || 'param').join(', ') || '';
        const bodyCode = callbackNode.body.type === 'BlockStatement'
            ? generate(callbackNode.body).code
            : `{ return ${generate(callbackNode.body).code}; }`;

        const functionCode = `async function ${functionName}(${params}) ${bodyCode}`;
        return this.cleanReactSyntax(functionCode);
    }

    /**
     * Convert useState to vanilla JS equivalent
     */
    convertStateToVanilla(getter, setter, initialValue) {
        return `let ${getter} = ${initialValue};\nfunction ${setter}(newValue) { ${getter} = newValue; }`;
    }

    /**
     * Convert useEffect to vanilla JS
     */
    convertEffectToVanilla(effectNode) {
        const bodyCode = generate(effectNode.body).code;
        return this.cleanReactSyntax(bodyCode);
    }

    /**
     * Clean React-specific syntax for vanilla JS
     */
    cleanReactSyntax(code) {
        return code
            // Replace React imports and JSX
            .replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, '')
            // Replace set functions with direct assignment where possible
            .replace(/set(\w+)\((.*?)\)/g, (match, varName, value) => {
                const lowerVarName = varName.charAt(0).toLowerCase() + varName.slice(1);
                return `${lowerVarName} = ${value}`;
            })
            // Replace process.env with window equivalent
            .replace(/process\.env\.NODE_ENV/g, 'window.NODE_ENV || "production"')
            // Replace axios with fetch API calls
            .replace(/await axios\.get\((.*?)\)/g, 'await fetch($1).then(res => res.json())')
            .replace(/axios\.get\((.*?)\)/g, 'fetch($1).then(res => res.json())')
            // Fix fallbackData references
            .replace(/fallbackData/g, 'getFallbackData()')
            // Remove undefined tokens that might be inserted
            .replace(/undefined/g, '')
            // Clean up extra whitespace and newlines
            .replace(/\n\s*\n/g, '\n')
            .replace(/^\s+|\s+$/g, '')
            .trim();
    }

    /**
     * Extract initial value from useState
     */
    extractInitialValue(node) {
        if (!node) return 'null';

        switch (node.type) {
            case 'NullLiteral':
                return 'null';
            case 'BooleanLiteral':
                return node.value.toString();
            case 'NumericLiteral':
                return node.value.toString();
            case 'StringLiteral':
                return `"${node.value}"`;
            case 'ArrayExpression':
                return '[]';
            case 'ObjectExpression':
                return '{}';
            default:
                return 'null';
        }
    }

    /**
     * Extract useEffect dependencies
     */
    extractEffectDependencies(depsNode) {
        if (!depsNode || depsNode.type !== 'ArrayExpression') {
            return [];
        }
        return depsNode.elements.map(el => el.name || el.value).filter(Boolean);
    }

    /**
     * Check if node is useState call
     */
    isUseStateCall(node) {
        return node?.type === 'CallExpression' &&
               node.callee?.name === 'useState';
    }

    /**
     * Check if node is useEffect call
     */
    isUseEffectCall(node) {
        return node?.type === 'CallExpression' &&
               node.callee?.name === 'useEffect';
    }

    /**
     * Check if node is useCallback call
     */
    isUseCallbackCall(node) {
        return node?.type === 'CallExpression' &&
               node.callee?.name === 'useCallback';
    }

    /**
     * Build final extraction result
     */
    buildExtractionResult() {
        return {
            functions: this.extractedFunctions,
            state: this.extractedState,
            logic: this.extractedLogic,
            warnings: this.warnings
        };
    }
}

class HTMLUpdater {
    constructor() {
        this.updateCount = 0;
        this.skipCount = 0;
        this.warnings = [];
    }

    /**
     * Update HTML file with extracted code
     */
    async updateHTML(htmlPath, extractionResult) {
        try {
            let htmlContent = fs.readFileSync(htmlPath, 'utf8');

            // Update functions
            for (const [functionName, functionData] of extractionResult.functions) {
                htmlContent = this.updateFunction(htmlContent, functionName, functionData);
            }

            // Update state variables
            htmlContent = this.updateStateVariables(htmlContent, extractionResult.state);

            // Write updated content back
            fs.writeFileSync(htmlPath, htmlContent, 'utf8');

            return {
                updated: this.updateCount,
                skipped: this.skipCount,
                warnings: this.warnings
            };
        } catch (error) {
            throw new Error(`Failed to update HTML file: ${error.message}`);
        }
    }

    /**
     * Update a specific function in HTML
     */
    updateFunction(htmlContent, functionName, functionData) {
        // Clean the function code first
        const cleanCode = functionData.code.replace(/undefined/g, '').trim();

        // Pattern to find existing function with more flexible matching
        const patterns = [
            // Standard function declaration
            new RegExp(`(\\s*)(function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\s*\\})`, 'gm'),
            // Function with comment placeholder
            new RegExp(`(\\s*)(function\\s+${functionName}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\})`, 'gm'),
            // Simple placeholder function
            new RegExp(`(\\s*)(function\\s+${functionName}\\([^)]*\\)\\s*\\{[\\s\\S]*?return[^}]*\\})`, 'gm')
        ];

        let replaced = false;

        for (const pattern of patterns) {
            const match = htmlContent.match(pattern);
            if (match) {
                // Replace existing function - preserve indentation
                const indentation = match[1] || '        ';
                const indentedCode = this.indentCode(cleanCode, indentation.length);
                htmlContent = htmlContent.replace(pattern, indentation + indentedCode);
                this.updateCount++;
                console.log(`✓ Updated function: ${functionName}`);
                replaced = true;
                break;
            }
        }

        if (!replaced) {
            // Function not found - try to insert before closing script tag
            const insertPoint = htmlContent.lastIndexOf('</script>');
            if (insertPoint !== -1) {
                const indentedFunction = this.indentCode(cleanCode, 8);
                htmlContent = htmlContent.slice(0, insertPoint) +
                             `\n        ${indentedFunction}\n\n    ` +
                             htmlContent.slice(insertPoint);
                this.updateCount++;
                console.log(`✓ Inserted new function: ${functionName}`);
            } else {
                this.warnings.push(`Could not find insertion point for function: ${functionName}`);
                this.skipCount++;
            }
        }

        return htmlContent;
    }

    /**
     * Update state variables in HTML
     */
    updateStateVariables(htmlContent, stateVars) {
        // Find global state section
        const statePattern = /\/\/\s*Global\s+state[\s\S]*?(?=\n\s*\/\/|\n\s*function|\n\s*document)/i;

        for (const stateVar of stateVars) {
            const varPattern = new RegExp(`let\\s+${stateVar.getter}\\s*=\\s*[^;]+;`, 'g');

            if (htmlContent.match(varPattern)) {
                // Update existing state variable
                htmlContent = htmlContent.replace(varPattern, `let ${stateVar.getter} = ${stateVar.initialValue};`);
                console.log(`✓ Updated state variable: ${stateVar.getter}`);
                this.updateCount++;
            } else if (htmlContent.match(statePattern)) {
                // Insert new state variable
                htmlContent = htmlContent.replace(statePattern, (match) => {
                    return match + `\n        let ${stateVar.getter} = ${stateVar.initialValue}; // ${stateVar.setter}`;
                });
                console.log(`✓ Inserted state variable: ${stateVar.getter}`);
                this.updateCount++;
            } else {
                this.warnings.push(`Could not update state variable: ${stateVar.getter}`);
                this.skipCount++;
            }
        }

        return htmlContent;
    }

    /**
     * Add proper indentation to code
     */
    indentCode(code, spaces) {
        const indent = ' '.repeat(spaces);
        return code.split('\n')
                  .map(line => line.trim() ? indent + line : line)
                  .join('\n');
    }
}

class SyncOrchestrator {
    constructor() {
        this.extractor = new ReactExtractor();
        this.updater = new HTMLUpdater();
    }

    /**
     * Main sync process
     */
    async sync(reactPath = './src/app/page.js', htmlPath = './index.html') {
        console.log('🚀 Starting React → HTML sync process...\n');

        try {
            // Validate files exist
            if (!fs.existsSync(reactPath)) {
                throw new Error(`React file not found: ${reactPath}`);
            }
            if (!fs.existsSync(htmlPath)) {
                throw new Error(`HTML file not found: ${htmlPath}`);
            }

            // Extract from React
            console.log(`📖 Parsing React file: ${reactPath}`);
            const extractionResult = await this.extractor.extractFromReact(reactPath);

            // Update HTML
            console.log(`\n📝 Updating HTML file: ${htmlPath}`);
            const updateResult = await this.updater.updateHTML(htmlPath, extractionResult);

            // Report results
            this.reportResults(extractionResult, updateResult);

        } catch (error) {
            console.error('❌ Sync failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Report sync results
     */
    reportResults(extractionResult, updateResult) {
        console.log('\n📊 Sync Results:');
        console.log('================');
        console.log(`Functions extracted: ${extractionResult.functions.size}`);
        console.log(`State variables extracted: ${extractionResult.state.length}`);
        console.log(`Updates applied: ${updateResult.updated}`);
        console.log(`Items skipped: ${updateResult.skipped}`);

        if (extractionResult.warnings.length > 0 || updateResult.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            [...extractionResult.warnings, ...updateResult.warnings].forEach(warning => {
                console.log(`  - ${warning}`);
            });
        }

        if (updateResult.skipped === 0 && updateResult.warnings.length === 0) {
            console.log('\n✅ Sync completed successfully!');
        } else {
            console.log('\n⚡ Sync completed with some issues. Check warnings above.');
        }
    }
}

// Check for required dependencies
function checkDependencies() {
    const required = ['@babel/parser', '@babel/traverse', '@babel/generator'];
    const missing = [];

    for (const dep of required) {
        try {
            require.resolve(dep);
        } catch {
            missing.push(dep);
        }
    }

    if (missing.length > 0) {
        console.error('❌ Missing required dependencies:');
        missing.forEach(dep => console.error(`  - ${dep}`));
        console.error('\nInstall with: npm install ' + missing.join(' '));
        process.exit(1);
    }
}

// Main execution
async function main() {
    checkDependencies();

    const orchestrator = new SyncOrchestrator();
    const args = process.argv.slice(2);

    const reactPath = args[0] || './src/app/page.js';
    const htmlPath = args[1] || './index.html';

    await orchestrator.sync(reactPath, htmlPath);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { ReactExtractor, HTMLUpdater, SyncOrchestrator };