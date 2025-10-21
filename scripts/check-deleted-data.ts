import 'dotenv/config';
import { query } from '../lib/neon';

async function checkDatabaseHistory() {
  try {
    console.log('🔍 Checking for any recoverable data...\n');

    // Check if there are any attendance records (might reference deleted people)
    const attendanceResult = await query(
      `SELECT COUNT(*) as count FROM attendance_records`
    );
    console.log('Attendance records:', attendanceResult.rows[0].count);

    // Check if there are any progress records (might reference deleted people)
    const progressResult = await query(
      `SELECT COUNT(*) as count FROM progress_records`
    );
    console.log('Progress records:', progressResult.rows[0].count);

    // Check SMS logs (might have phone numbers)
    const smsResult = await query(
      `SELECT COUNT(*) as count FROM sms_logs`
    );
    console.log('SMS logs:', smsResult.rows[0].count);

    // Check if we can see table structure to understand what was there
    console.log('\n📋 Registered People Table Structure:');
    const structureResult = await query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'registered_people'
       ORDER BY ordinal_position`
    );
    structureResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkDatabaseHistory()
  .then(() => {
    console.log('\n✅ Check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
