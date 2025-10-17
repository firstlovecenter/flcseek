import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function setupDatabase() {
  console.log('🔧 Setting up FLC Sheep Seeking Database...\n');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Supabase credentials not found in .env file');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('📝 Reading migration file...');
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
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
  console.log('1. Log in to your Supabase dashboard');
  console.log('2. Navigate to the SQL Editor');
  console.log('3. Copy the SQL from supabase/migrations/001_initial_schema.sql');
  console.log('4. Paste and execute it in the Supabase SQL Editor\n');
  console.log('✅ Once complete, you can log in with:');
  console.log('   Username: admin');
  console.log('   Password: admin123\n');
  console.log('⚠️  Remember to change the default password after first login!\n');

  console.log('📍 Migration file location:');
  console.log(migrationPath);
}

setupDatabase().catch(console.error);
