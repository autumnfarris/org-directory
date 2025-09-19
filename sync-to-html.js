#!/usr/bin/env node

const { SyncOrchestrator } = require('./sync');

/**
 * Legacy wrapper for React to HTML conversion
 * Now uses the robust AST-based sync.js under the hood
 *
 * @deprecated Use sync.js directly for better reliability and features
 */
class ReactToHtmlConverter {
    constructor() {
        this.orchestrator = new SyncOrchestrator();
        this.pageJsPath = './src/app/page.js';
        this.indexHtmlPath = './index.html';

        console.log('⚠️  Note: sync-to-html.js is now using the improved AST-based sync engine');
        console.log('💡 Consider using "npm run sync" or "node sync.js" for better performance');
    }

    /**
     * Main sync function - now delegates to the robust sync orchestrator
     */
    async updateHtml() {
        try {
            await this.orchestrator.sync(this.pageJsPath, this.indexHtmlPath);
        } catch (error) {
            console.error('❌ Error syncing files:', error.message);
            process.exit(1);
        }
    }
}

// Run the converter
if (require.main === module) {
    const converter = new ReactToHtmlConverter();
    converter.updateHtml().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = ReactToHtmlConverter;