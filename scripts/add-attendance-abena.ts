import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function addAttendanceForAbena() {
  try {
    console.log('Finding Abena Gyamfi...');
    
    // Find Abena Gyamfi's ID
    const people = await sql`
      SELECT id, first_name, last_name 
      FROM new_converts 
      WHERE first_name ILIKE '%Abena%' AND last_name ILIKE '%Gyamfi%'
    `;
    
    if (people.length === 0) {
      console.log('Abena Gyamfi not found!');
      return;
    }
    
    const abena = people[0];
    console.log(`Found: ${abena.first_name} ${abena.last_name} (ID: ${abena.id})`);
    
    // Get a superadmin user to use as recorded_by
    const users = await sql`
      SELECT id FROM users WHERE role = 'superadmin' LIMIT 1
    `;
    
    if (users.length === 0) {
      console.log('No superadmin user found!');
      return;
    }
    
    const recordedBy = users[0].id;
    console.log(`Using user ID: ${recordedBy}`);
    
    // Check existing attendance count
    const existingAttendance = await sql`
      SELECT COUNT(*) as count 
      FROM attendance_records 
      WHERE person_id = ${abena.id}
    `;
    
    const currentCount = parseInt(existingAttendance[0].count);
    console.log(`Current attendance count: ${currentCount}`);
    
    if (currentCount >= 20) {
      console.log('Abena already has 20 or more attendance records!');
      return;
    }
    
    const recordsToAdd = 20 - currentCount;
    console.log(`Adding ${recordsToAdd} more attendance records...`);
    
    // Get all existing dates for this person to avoid duplicates
    const existingDates = await sql`
      SELECT date_attended 
      FROM attendance_records 
      WHERE person_id = ${abena.id}
    `;
    
    const existingDateStrings = new Set(
      existingDates.map((r: any) => r.date_attended.toISOString().split('T')[0])
    );
    
    // Generate dates for Sundays in the past (going backwards from today)
    const attendanceDates: string[] = [];
    const today = new Date();
    let currentDate = new Date(today);
    
    // Go back to the most recent Sunday
    while (currentDate.getDay() !== 0) {
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    // Generate Sunday dates going backwards, skipping existing ones
    while (attendanceDates.length < recordsToAdd) {
      const dateString = currentDate.toISOString().split('T')[0];
      if (!existingDateStrings.has(dateString)) {
        attendanceDates.push(dateString);
      }
      currentDate.setDate(currentDate.getDate() - 7); // Go back one week
    }
    
    // Insert attendance records
    for (const date of attendanceDates) {
      // Check if this date already exists
      const existing = await sql`
        SELECT id FROM attendance_records 
        WHERE person_id = ${abena.id} AND date_attended = ${date}
      `;
      
      if (existing.length === 0) {
        await sql`
          INSERT INTO attendance_records (person_id, date_attended, recorded_by, created_at)
          VALUES (${abena.id}, ${date}, ${recordedBy}, NOW())
        `;
        console.log(`✓ Added attendance for ${date}`);
      } else {
        console.log(`⊘ Skipped ${date} (already exists)`);
      }
    }
    
    // Verify final count
    const finalAttendance = await sql`
      SELECT COUNT(*) as count 
      FROM attendance_records 
      WHERE person_id = ${abena.id}
    `;
    
    const finalCount = parseInt(finalAttendance[0].count);
    console.log(`\n✅ Complete! Abena now has ${finalCount} attendance records.`);
    
  } catch (error) {
    console.error('Error adding attendance:', error);
    throw error;
  }
}

addAttendanceForAbena()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
