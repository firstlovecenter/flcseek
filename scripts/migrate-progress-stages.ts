import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  try {
    console.log('🚀 Running progress_stages migration...\n');

    // Read the migration file
    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '002_create_progress_stages.sql'
    );

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await sql([statement] as any);
        console.log('✅ Success\n');
      } catch (error: any) {
        // Ignore errors for existing objects
        if (error.message?.includes('already exists')) {
          console.log('⚠️  Already exists, skipping\n');
        } else {
          throw error;
        }
      }
    }

    // Verify the data
    console.log('Verifying milestones...');
    const milestones = await sql`
      SELECT stage_number, stage_name 
      FROM progress_stages 
      ORDER BY stage_number
    `;

    console.log(`\n✅ Migration complete! ${milestones.length} milestones created:\n`);
    milestones.forEach((m: any) => {
      console.log(`   ${m.stage_number}. ${m.stage_name}`);
    });

    console.log('\n🎉 All done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
