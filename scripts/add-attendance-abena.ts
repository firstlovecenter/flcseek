import { query } from '../lib/neon';

async function addAttendanceForAbena() {
  try {
    // First, find Abena (Nkrumah or Gyamfi)
    const personResult = await query(
      "SELECT id, full_name FROM registered_people WHERE full_name ILIKE '%Abena%Gyamfi%' OR full_name ILIKE '%Gyamfi%Abena%' LIMIT 1"
    );

    if (personResult.rows.length === 0) {
      console.log('❌ Abena Gyamfi not found in database');
      console.log('Searching for similar names...');
      
      const similarNames = await query(
        "SELECT id, full_name FROM registered_people WHERE full_name ILIKE '%Gyamfi%' OR full_name ILIKE '%Abena%' LIMIT 5"
      );
      
      if (similarNames.rows.length > 0) {
        console.log('Found similar names:');
        similarNames.rows.forEach((person: any) => {
          console.log(`- ${person.full_name} (ID: ${person.id})`);
        });
      }
      return;
    }

    const person = personResult.rows[0];
    console.log(`✅ Found: ${person.full_name} (ID: ${person.id})`);

    // Get a user to use as recorded_by (preferably an admin from the same group)
    const userResult = await query(
      "SELECT id FROM users WHERE role IN ('admin', 'leader') LIMIT 1"
    );

    if (userResult.rows.length === 0) {
      console.log('❌ No admin or leader user found in database');
      return;
    }

    const recordedBy = userResult.rows[0].id;
    console.log(`👤 Recording attendance by user ID: ${recordedBy}`);

    // Check existing attendance records
    const existingAttendance = await query(
      'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
      [person.id]
    );
    
    const existingCount = parseInt(existingAttendance.rows[0].count);
    console.log(`📊 Current attendance records: ${existingCount}`);

    // Generate 13 Sunday dates (going back from most recent Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mostRecentSunday = new Date(today);
    mostRecentSunday.setDate(today.getDate() - dayOfWeek);
    
    const attendanceDates: string[] = [];
    for (let i = 0; i < 13; i++) {
      const date = new Date(mostRecentSunday);
      date.setDate(mostRecentSunday.getDate() - (i * 7)); // Go back 7 days each time
      attendanceDates.push(date.toISOString().split('T')[0]);
    }

    console.log(`\n📅 Adding 13 attendance records for Sundays...`);
    
    let addedCount = 0;
    for (const date of attendanceDates) {
      try {
        // Check if attendance already exists for this date
        const existing = await query(
          'SELECT id FROM attendance_records WHERE person_id = $1 AND date_attended = $2',
          [person.id, date]
        );

        if (existing.rows.length === 0) {
          await query(
            'INSERT INTO attendance_records (person_id, date_attended, recorded_by) VALUES ($1, $2, $3)',
            [person.id, date, recordedBy]
          );
          console.log(`   ✓ Added: ${date}`);
          addedCount++;
        } else {
          console.log(`   ⊘ Skipped (exists): ${date}`);
        }
      } catch (error: any) {
        console.log(`   ✗ Error for ${date}: ${error.message}`);
      }
    }

    // Get final count
    const finalAttendance = await query(
      'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
      [person.id]
    );
    
    const finalCount = parseInt(finalAttendance.rows[0].count);
    console.log(`\n✅ Complete! Total attendance records: ${finalCount} (added ${addedCount} new)`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

addAttendanceForAbena();
