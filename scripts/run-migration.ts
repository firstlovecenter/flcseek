import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: No database connection string found.');
  console.error('   Please set NEON_DATABASE_URL or DATABASE_URL in your .env file');
  process.exit(1);
}

const sql = neon(connectionString);

async function runMigration(migrationFile?: string) {
  console.log('🚀 Starting database migration...');
  console.log('📁 Migration file:', migrationFile || '014_comprehensive_improvements.sql');
  
  try {
    // Read the migration file
    const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
    const fileName = migrationFile || '014_comprehensive_improvements.sql';
    const filePath = path.join(migrationsDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${filePath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(filePath, 'utf-8');
    
    // Remove comment blocks and split by semicolons
    // First remove block comments
    let cleanSQL = migrationSQL.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove line comments but keep the content
    cleanSQL = cleanSQL.replace(/--[^\n]*/g, '');
    
    // Remove DO blocks with RAISE NOTICE (PostgreSQL-specific, not supported in Neon serverless)
    cleanSQL = cleanSQL.replace(/DO \$\$[\s\S]*?END \$\$/g, '');
    
    // Split by semicolons and filter
    const statements = cleanSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements
      if (!statement || statement.length < 5) {
        continue;
      }
      
      try {
        // Use sql.query() for raw SQL strings
        await sql.query(statement);
        successCount++;
        
        // Log progress
        console.log(`   ✓ [${successCount}/${statements.length}] ${statement.substring(0, 60).replace(/\n/g, ' ')}...`);
      } catch (error: any) {
        // Some errors are expected (like "already exists")
        if (error.message?.includes('already exists') || 
            error.message?.includes('does not exist') ||
            error.message?.includes('duplicate key') ||
            error.message?.includes('column') && error.message?.includes('already exists')) {
          skipCount++;
          console.log(`   ⚠ [SKIP] ${statement.substring(0, 50).replace(/\n/g, ' ')}... (already exists)`);
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          console.error(`      SQL: ${statement.substring(0, 80).replace(/\n/g, ' ')}...`);
        }
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✓ Successful: ${successCount}`);
    console.log(`   ⚠ Skipped: ${skipCount}`);
    console.log('\n✅ Migration completed!');
    
    // Verify some key changes
    console.log('\n🔍 Verifying migration...');
    
    // Check if is_auto_calculated column exists
    const milestoneCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'milestones' AND column_name = 'is_auto_calculated'
    `;
    console.log(`   • is_auto_calculated column: ${milestoneCheck.length > 0 ? '✓ EXISTS' : '✗ MISSING'}`);
    
    // Check if activity_logs table exists
    const activityLogsCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'activity_logs'
    `;
    console.log(`   • activity_logs table: ${activityLogsCheck.length > 0 ? '✓ EXISTS' : '✗ MISSING'}`);
    
    // Check if notifications table exists
    const notificationsCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'notifications'
    `;
    console.log(`   • notifications table: ${notificationsCheck.length > 0 ? '✓ EXISTS' : '✗ MISSING'}`);
    
    // Check if milestone 18 has is_auto_calculated set
    const milestone18Check = await sql`
      SELECT stage_number, is_auto_calculated 
      FROM milestones 
      WHERE stage_number = 18
    `;
    console.log(`   • Milestone 18 auto-calculated: ${milestone18Check[0]?.is_auto_calculated ? '✓ TRUE' : '✗ FALSE or NOT SET'}`);
    
    console.log('\n🎉 All done!');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];
runMigration(migrationFile);
