import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkSchema() {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ No database connection string found');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Check all tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n📋 Current tables:');
    tables.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });

    // Check if groups table exists
    const groupsCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'groups'
      ORDER BY ordinal_position;
    `);

    if (groupsCheck.rows.length > 0) {
      console.log('\n⚠️ Groups table already exists with columns:');
      groupsCheck.rows.forEach((row) => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
