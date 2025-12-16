/**
 * Publish Stats Script
 * 
 * Usage:
 *   node scripts/publish-stats.js path/to/stats.html
 * 
 * This script deploys a stats HTML file to Cloudflare Pages.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const ACCOUNT_ID = process.env.REACT_APP_CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.REACT_APP_CLOUDFLARE_API_TOKEN;
const PROJECT_NAME = process.env.REACT_APP_CLOUDFLARE_PROJECT_NAME || 'pl-publish';

// Get the HTML file path from command line args
const htmlFile = process.argv[2];

if (!htmlFile) {
  console.log('Usage: node scripts/publish-stats.js <path-to-html-file>');
  console.log('');
  console.log('Example: node scripts/publish-stats.js ~/Downloads/purchase-line-2025-stats.html');
  process.exit(1);
}

if (!fs.existsSync(htmlFile)) {
  console.error(`File not found: ${htmlFile}`);
  process.exit(1);
}

async function publish() {
  console.log('📤 Publishing to Cloudflare Pages...');
  console.log(`   Project: ${PROJECT_NAME}`);
  console.log(`   File: ${htmlFile}`);
  
  // Create a temporary directory for the build
  const tempDir = path.join(__dirname, '..', '.publish-temp');
  
  // Clean up if exists
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir);
  
  // Copy the HTML file as index.html
  fs.copyFileSync(htmlFile, path.join(tempDir, 'index.html'));
  
  try {
    // Use wrangler to deploy
    execSync(
      `npx wrangler pages deploy "${tempDir}" --project-name="${PROJECT_NAME}"`,
      {
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
          CLOUDFLARE_API_TOKEN: API_TOKEN,
        },
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      }
    );
    
    console.log('');
    console.log('✅ Published successfully!');
    console.log(`🌐 View at: https://${PROJECT_NAME}.pages.dev`);
  } catch (error) {
    console.error('❌ Failed to publish:', error.message);
  } finally {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  }
}

publish();
