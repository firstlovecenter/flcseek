/**
 * Database Setup Script
 * Runs the initial migration to set up FLCSeek database
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if .env.local exists
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ Error: .env.local file not found!');
  console.error('\nPlease create .env.local with:');
  console.error('NEON_DATABASE_URL=your_neon_connection_string');
  console.error('JWT_SECRET=your_jwt_secret');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: NEON_DATABASE_URL not found in .env.local');
  process.exit(1);
}

console.log('🚀 Starting FLCSeek Database Setup...\n');

// Path to migration file
const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '000_initial_setup.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Error: Migration file not found at:', migrationPath);
  process.exit(1);
}

console.log('📁 Migration file:', migrationPath);
console.log('🔗 Database URL:', dbUrl.replace(/:[^:@]+@/, ':****@'), '\n');

// Check if psql is available
const psqlCheck = spawn('psql', ['--version']);

psqlCheck.on('error', () => {
  console.error('❌ Error: psql (PostgreSQL client) not found!');
  console.error('\nPlease install PostgreSQL client:');
  console.error('  - Windows: Download from https://www.postgresql.org/download/windows/');
  console.error('  - macOS: brew install postgresql');
  console.error('  - Linux: sudo apt-get install postgresql-client');
  console.error('\nAlternatively, run the migration via Neon Dashboard:');
  console.error('  1. Go to https://console.neon.tech');
  console.error('  2. Select your project');
  console.error('  3. Open SQL Editor');
  console.error('  4. Copy contents of db/migrations/000_initial_setup.sql');
  console.error('  5. Run the migration');
  process.exit(1);
});

psqlCheck.on('close', (code) => {
  if (code === 0) {
    // psql is available, run the migration
    console.log('✅ PostgreSQL client found, running migration...\n');
    
    const psql = spawn('psql', [dbUrl, '-f', migrationPath], {
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: extractPassword(dbUrl) }
    });

    psql.on('error', (error) => {
      console.error('❌ Error running migration:', error.message);
      process.exit(1);
    });

    psql.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Database setup complete!');
        console.log('\nNext steps:');
        console.log('  1. Run: npm run dev');
        console.log('  2. Visit: http://localhost:3000');
        console.log('  3. Login with username: superadmin, password: admin123');
        console.log('  4. Change superadmin password immediately!\n');
      } else {
        console.error('\n❌ Migration failed with exit code:', code);
        process.exit(code);
      }
    });
  }
});

function extractPassword(url) {
  const match = url.match(/:\/\/[^:]+:([^@]+)@/);
  return match ? match[1] : '';
}
