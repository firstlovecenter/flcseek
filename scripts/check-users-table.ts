import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL;

async function checkUsersTable() {
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    
    console.log('🔍 Checking users table structure...\n');
    
    // Get column information
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Users table columns:');
    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Sample user data
    const usersResult = await client.query(`
      SELECT id, username, first_name, last_name, role, created_at 
      FROM users 
      LIMIT 5;
    `);
    
    console.log('\n👥 Sample users:');
    usersResult.rows.forEach(user => {
      console.log(`   - ${user.username} (${user.first_name} ${user.last_name}) - Role: ${user.role || 'None'}`);
    });
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUsersTable();
