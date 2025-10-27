import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function checkAttendanceMilestone() {
  try {
    console.log('Checking Abena Gyamfi attendance and milestone status...\n');
    
    // Find Abena Gyamfi
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
    
    // Check attendance count
    const attendanceCount = await sql`
      SELECT COUNT(*) as count 
      FROM attendance_records 
      WHERE person_id = ${abena.id}
    `;
    
    const count = parseInt(attendanceCount[0].count);
    console.log(`\nAttendance Records: ${count}`);
    
    // Check milestone 18 status
    const milestone = await sql`
      SELECT stage_number, stage_name, is_completed, date_completed
      FROM progress_records 
      WHERE person_id = ${abena.id} AND stage_number = 18
    `;
    
    if (milestone.length === 0) {
      console.log('\n❌ Milestone 18 (Attendance) record NOT FOUND!');
      console.log('Creating milestone record...');
      
      // Get a superadmin user to use as updated_by
      const users = await sql`
        SELECT id FROM users WHERE role = 'superadmin' LIMIT 1
      `;
      
      if (users.length === 0) {
        console.log('No superadmin user found!');
        return;
      }
      
      const updatedBy = users[0].id;
      
      // Get the stage name from milestones table
      const milestoneInfo = await sql`
        SELECT stage_name FROM milestones WHERE stage_number = 18
      `;
      
      const stageName = milestoneInfo[0]?.stage_name || 'Attendance';
      
      // Create the milestone record
      await sql`
        INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, date_completed, updated_by)
        VALUES (${abena.id}, 18, ${stageName}, ${count >= 10}, ${count >= 10 ? new Date().toISOString().split('T')[0] : null}, ${updatedBy})
      `;
      
      console.log('✅ Milestone 18 record created!');
    } else {
      const m = milestone[0];
      console.log(`\nMilestone 18 (${m.stage_name}):`);
      console.log(`  - Completed: ${m.is_completed ? 'Yes ✅' : 'No ❌'}`);
      console.log(`  - Date Completed: ${m.date_completed || 'N/A'}`);
      
      if (count >= 10 && !m.is_completed) {
        console.log('\n⚠️  Attendance count >= 10 but milestone not marked complete!');
        console.log('Updating milestone...');
        
        // Get a superadmin user to use as updated_by
        const users = await sql`
          SELECT id FROM users WHERE role = 'superadmin' LIMIT 1
        `;
        
        const updatedBy = users[0]?.id;
        
        await sql`
          UPDATE progress_records 
          SET is_completed = true, date_completed = ${new Date().toISOString().split('T')[0]}, updated_by = ${updatedBy}
          WHERE person_id = ${abena.id} AND stage_number = 18
        `;
        
        console.log('✅ Milestone 18 updated to completed!');
      } else if (count >= 10 && m.is_completed) {
        console.log('\n✅ Everything is correct! Milestone already completed.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

checkAttendanceMilestone()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
