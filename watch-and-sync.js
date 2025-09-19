#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ReactToHtmlConverter = require('./sync-to-html');

/**
 * File watcher that automatically syncs page.js changes to index.html
 */
class FileWatcher {
    constructor() {
        this.converter = new ReactToHtmlConverter();
        this.pageJsPath = './src/app/page.js';
        this.debounceTimeout = null;
        this.debounceDelay = 1000; // 1 second
    }

    /**
     * Debounced sync function to avoid multiple rapid updates
     */
    debouncedSync() {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            console.log(`\n📝 ${new Date().toLocaleTimeString()} - page.js changed, syncing to index.html...`);
            try {
                this.converter.updateHtml();
            } catch (error) {
                console.error('Sync failed:', error.message);
            }
        }, this.debounceDelay);
    }

    /**
     * Start watching for file changes
     */
    start() {
        console.log('🔍 Watching for changes in src/app/page.js...');
        console.log('📋 Changes will automatically sync to index.html');
        console.log('⏹️  Press Ctrl+C to stop watching\n');

        // Perform initial sync
        console.log('🔄 Performing initial sync...');
        try {
            this.converter.updateHtml();
        } catch (error) {
            console.error('Initial sync failed:', error.message);
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
    watcher.start();
}

module.exports = FileWatcher;