import { Pool } from '@neondatabase/serverless';

const ATTENDANCE_GOAL = 20;

async function syncAttendanceMilestone() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  
  try {
    console.log('Starting attendance milestone sync...\n');
    
    // Get all registered people
    const peopleResult = await pool.query('SELECT id, full_name FROM registered_people');
    const people = peopleResult.rows;
    
    console.log(`Found ${people.length} registered people\n`);
    
    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const person of people) {
      // Count attendance records for this person
      const attendanceCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
        [person.id]
      );
      
      const attendanceCount = parseInt(attendanceCountResult.rows[0].count);
      const shouldBeCompleted = attendanceCount >= ATTENDANCE_GOAL;
      
      // Get current milestone 18 status
      const milestone18Result = await pool.query(
        'SELECT is_completed FROM progress_records WHERE person_id = $1 AND stage_number = 18',
        [person.id]
      );
      
      if (milestone18Result.rows.length === 0) {
        console.log(`⚠️  ${person.full_name}: No milestone 18 record found. Skipping.`);
        continue;
      }
      
      const currentStatus = milestone18Result.rows[0].is_completed;
      
      // Check if update is needed
      if (currentStatus === shouldBeCompleted) {
        alreadyCorrectCount++;
        console.log(`✓ ${person.full_name}: Already correct (${attendanceCount} attendances, M18: ${shouldBeCompleted ? 'completed' : 'pending'})`);
      } else {
        // Update milestone 18
        const dateCompleted = shouldBeCompleted ? new Date().toISOString().split('T')[0] : null;
        
        await pool.query(
          `UPDATE progress_records 
           SET is_completed = $1, date_completed = $2, last_updated = $3
           WHERE person_id = $4 AND stage_number = 18`,
          [shouldBeCompleted, dateCompleted, new Date().toISOString(), person.id]
        );
        
        updatedCount++;
        console.log(`✅ ${person.full_name}: Updated M18 (${attendanceCount} attendances → M18: ${shouldBeCompleted ? 'completed' : 'pending'})`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Sync completed!');
    console.log(`✅ Updated: ${updatedCount} people`);
    console.log(`✓ Already correct: ${alreadyCorrectCount} people`);
    console.log(`📊 Total processed: ${people.length} people`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error syncing attendance milestone:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

syncAttendanceMilestone();
