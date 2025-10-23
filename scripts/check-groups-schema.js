require('dotenv').config();
const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'groups' 
      ORDER BY ordinal_position
    `);
    
    console.log('Groups table columns:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type})`);
    });
    
    // Also get a sample row
    const sample = await pool.query('SELECT * FROM groups LIMIT 1');
    console.log('\nSample row:');
    console.log(sample.rows[0] || 'No rows in table');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
