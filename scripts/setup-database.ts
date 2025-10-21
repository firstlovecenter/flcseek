import * as fs from 'fs';
import * as path from 'path';

async function setupDatabase() {
  console.log('🔧 Setting up FLC Sheep Seeking Database (Neon)...\n');

  const connectionString = process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: NEON_DATABASE_URL not found in .env file');
    console.error('Please set NEON_DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('📝 Reading migration file...');
  const migrationPath = path.join(
    process.cwd(),
    'db',
    'migrations',
    '001_initial_schema.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Error: Migration file not found at', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('🚀 Executing migration...\n');
  console.log('⚠️  NOTE: This script provides the SQL for you to run manually.');
  console.log('📋 Please follow these steps:\n');
  console.log('1. Connect to your Neon database');
  console.log('2. Navigate to the SQL Editor in Neon Console');
  console.log('3. Copy the SQL from db/migrations/001_initial_schema.sql');
  console.log('4. Paste and execute it in the Neon SQL Editor\n');
  console.log('✅ Once complete, you can log in with:');
  console.log('   Username: admin');
  console.log('   Password: admin123\n');
  console.log('⚠️  Remember to change the default password after first login!\n');

  console.log('📍 Migration file location:');
  console.log(migrationPath);
}

setupDatabase().catch(console.error);
