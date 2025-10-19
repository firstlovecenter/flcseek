import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      if (key === 'NEON_DATABASE_URL') {
        return value;
      }
    }
  }
  return null;
}

async function populateDatabase() {
  const databaseUrl = loadEnvLocal();

  if (!databaseUrl) {
    console.error('❌ NEON_DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  console.log('🚀 Starting database population...\n');

  try {
    const sql = neon(databaseUrl);

    // Read the SQL file
    const sqlFilePath = join(process.cwd(), 'scripts', 'populate-members.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf-8');

    console.log('📄 SQL file loaded successfully');
    console.log('📊 Populating 120 members across 12 departments...\n');

    // Execute the entire SQL content (Neon supports multi-statement execution)
    try {
      // Create a simple query function that accepts raw SQL
      const response = await fetch(`${databaseUrl.replace('postgresql://', 'https://').split('@')[1].split('/')[0]}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: sqlContent,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('\n✅ Database population completed!');
    } catch (error: any) {
      console.log('\n⚠️  SQL execution approach failed, trying statement-by-statement...\n');
      
      // Fallback: Execute statement by statement
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && s.toLowerCase().includes('insert'));

      for (const statement of statements) {
        try {
          // Use raw query execution
          await sql.query(statement);
          process.stdout.write('.');
        } catch (err: any) {
          if (!err.message.includes('duplicate key')) {
            console.error(`\n⚠️  Error: ${err.message}`);
          }
        }
      }
      console.log('\n');
    }

    // Verify the data
    console.log('\n📊 Verifying data...\n');
    
    const result = await sql`
      SELECT department_name, COUNT(*) as member_count 
      FROM registered_people 
      GROUP BY department_name 
      ORDER BY department_name
    `;

    console.log('Department Members:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let totalMembers = 0;
    result.forEach((row: any) => {
      console.log(`${row.department_name.padEnd(15)} ${row.member_count} members`);
      totalMembers += Number(row.member_count);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total:          ${totalMembers} members`);
    
    console.log('\n🎉 All done! Your database is now populated with sample members.');
    
  } catch (error: any) {
    console.error('\n❌ Error populating database:', error.message);
    process.exit(1);
  }
}

populateDatabase();
