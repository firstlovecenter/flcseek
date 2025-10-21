import 'dotenv/config';
import { query } from '../lib/neon';

async function checkSmsLogs() {
  try {
    console.log('📱 Checking SMS logs for any recoverable information...\n');

    const smsResult = await query(
      `SELECT * FROM sms_logs ORDER BY created_at DESC`
    );

    if (smsResult.rows.length > 0) {
      console.log(`Found ${smsResult.rows.length} SMS logs:\n`);
      smsResult.rows.forEach((log, index) => {
        console.log(`${index + 1}. Phone: ${log.phone_number}`);
        console.log(`   Sent at: ${log.created_at}`);
        console.log(`   Status: ${log.status}`);
        if (log.message) {
          console.log(`   Message: ${log.message.substring(0, 50)}...`);
        }
        console.log('');
      });
    } else {
      console.log('No SMS logs found.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkSmsLogs()
  .then(() => {
    console.log('\n✅ Check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
