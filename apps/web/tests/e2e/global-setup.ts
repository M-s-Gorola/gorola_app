import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config: FullConfig) {
  console.log('\n--- [E2E GLOBAL SETUP START] ---');
  
  const apiRoot = path.resolve(__dirname, '../../api');
  
  try {
    // We run the bootstrap script we created earlier. 
    // It handles migration + double-seed (Catalog + E2E).
    const apiRoot = path.resolve(__dirname, '../../../../apps/api');
    const scriptPath = path.resolve(apiRoot, 'scripts/bootstrap-test-db.cjs');
    console.log(`Running: node ${scriptPath}`);
    
    const { spawnSync } = await import('child_process');
    spawnSync('node', [scriptPath], { 
      cwd: apiRoot, 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    console.log('--- [E2E GLOBAL SETUP COMPLETE] ---\n');
  } catch (error) {
    console.error('!!! [E2E GLOBAL SETUP FAILED] !!!');
    console.error(error);
    process.exit(1);
  }
}

export default globalSetup;
