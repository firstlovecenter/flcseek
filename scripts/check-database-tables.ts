import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL;

async function checkTables() {
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    console.log('🔍 Checking database tables...\n');
    
    // Check for departments table
    const deptCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'departments'
      );
    `);
    console.log(`📋 'departments' table exists: ${deptCheck.rows[0].exists}`);
    
    // Check for groups table
    const groupsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'groups'
      );
    `);
    console.log(`📋 'groups' table exists: ${groupsCheck.rows[0].exists}`);
    
    // Check registered_people columns
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'registered_people' 
      AND column_name IN ('department_name', 'group_name');
    `);
    console.log(`\n📋 'registered_people' columns:`);
    columnsCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTables();
