#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { SyncOrchestrator } = require('./sync');

/**
 * File watcher that automatically syncs page.js changes to index.html
 * Now uses the robust AST-based sync engine for reliable updates
 */
class FileWatcher {
    constructor() {
        this.orchestrator = new SyncOrchestrator();
        this.pageJsPath = './src/app/page.js';
        this.indexHtmlPath = './index.html';
        this.debounceTimeout = null;
        this.debounceDelay = 1500; // 1.5 seconds to account for AST processing

        console.log('🚀 Using improved AST-based sync engine for reliable updates');
    }

    /**
     * Debounced sync function to avoid multiple rapid updates
     */
    debouncedSync() {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(async () => {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`\n📝 ${timestamp} - page.js changed, syncing to index.html...`);
            try {
                await this.orchestrator.sync(this.pageJsPath, this.indexHtmlPath);
            } catch (error) {
                console.error(`❌ Sync failed at ${timestamp}:`, error.message);
            }
        }, this.debounceDelay);
    }

    /**
     * Start watching for file changes
     */
    async start() {
        console.log('🔍 Watching for changes in src/app/page.js...');
        console.log('📋 Changes will automatically sync to index.html');
        console.log('⏹️  Press Ctrl+C to stop watching\n');

        // Perform initial sync
        console.log('🔄 Performing initial sync...');
        try {
            await this.orchestrator.sync(this.pageJsPath, this.indexHtmlPath);
        } catch (error) {
            console.error('❌ Initial sync failed:', error.message);
            console.log('🔍 Will continue watching for changes...\n');
        }

        // Watch for changes
        fs.watchFile(this.pageJsPath, { interval: 500 }, (curr, prev) => {
            // Only sync if the file was actually modified
            if (curr.mtime !== prev.mtime) {
                this.debouncedSync();
            }
        });

        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\n👋 Stopping file watcher...');
            fs.unwatchFile(this.pageJsPath);
            process.exit(0);
        });
    }
}

// Run the watcher
if (require.main === module) {
    const watcher = new FileWatcher();
    watcher.start().catch(error => {
        console.error('💥 Watcher startup failed:', error);
        process.exit(1);
    });
}

module.exports = FileWatcher;