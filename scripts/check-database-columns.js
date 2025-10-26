const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

async function checkColumns() {
  try {
    console.log('Checking new_converts table columns...\n');
    
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'new_converts'
      ORDER BY ordinal_position
    `;

    const required = [
      'first_name',
      'last_name',
      'phone_number',
      'date_of_birth',
      'gender',
      'residential_location',
      'school_residential_location',
      'occupation_type'
    ];

    console.log('REQUIRED COLUMNS STATUS:');
    console.log('========================\n');

    const existing = columns.map(c => c.column_name);
    const missing = [];

    required.forEach(colName => {
      const col = columns.find(c => c.column_name === colName);
      if (col) {
        console.log(`✅ ${colName.padEnd(30)} - ${col.data_type}`);
      } else {
        console.log(`❌ ${colName.padEnd(30)} - MISSING`);
        missing.push(colName);
      }
    });

    console.log('\n\nALL COLUMNS IN TABLE:');
    console.log('=====================\n');
    columns.forEach(col => {
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable}`);
    });

    console.log('\n\nSUMMARY:');
    console.log('========');
    console.log(`Total columns: ${columns.length}`);
    console.log(`Required columns present: ${required.length - missing.length}/${required.length}`);
    if (missing.length > 0) {
      console.log(`\n❌ Missing columns: ${missing.join(', ')}`);
    } else {
      console.log('\n✅ All required columns are present!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

checkColumns();
