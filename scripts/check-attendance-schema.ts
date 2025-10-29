import { config } from 'dotenv';
import { query } from '../lib/neon';

config();

async function checkSchema() {
  try {
    console.log('Checking attendance_records schema...');
    
    const schema = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'attendance_records' 
      ORDER BY ordinal_position
    `);
    
    console.log('Columns:', schema.rows);
    
    console.log('\nFetching sample data...');
    const data = await query(`
      SELECT * FROM attendance_records 
      ORDER BY attendance_date DESC 
      LIMIT 5
    `);
    
    console.log('Sample records:', data.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSchema();
