import { Pool } from '@neondatabase/serverless';

const PROGRESS_STAGES = [
  { number: 1, name: 'Registered as Church Member' },
  { number: 2, name: 'Visited (First Quarter)' },
  { number: 3, name: 'Visited (Second Quarter)' },
  { number: 4, name: 'Visited (Third Quarter)' },
  { number: 5, name: 'Completed New Believers School' },
  { number: 6, name: 'Baptized in Water' },
  { number: 7, name: 'Baptized in the Holy Ghost' },
  { number: 8, name: 'Completed Soul-Winning School' },
  { number: 9, name: 'Invited Friend to Church' },
  { number: 10, name: 'Joined Basonta or Creative Arts' },
  { number: 11, name: 'Introduced to Lead Pastor' },
  { number: 12, name: 'Introduced to First Love Mother' },
  { number: 13, name: 'Attended All-Night Prayer' },
  { number: 14, name: 'Attended Meeting God' },
  { number: 15, name: 'Attended Federal Event' },
  { number: 16, name: 'Completed Seeing & Hearing Education' },
  { number: 17, name: 'Interceded For (3+ Hours)' },
  { number: 18, name: 'Attended 20 Sunday Services' }
];

const ATTENDANCE_GOAL = 20;

async function initializeMissingProgressRecords() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  
  try {
    console.log('Initializing missing progress records...\n');
    
    // Get a superadmin user to use as updated_by
    const adminResult = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['superadmin']);
    const adminId = adminResult.rows[0]?.id;
    
    if (!adminId) {
      throw new Error('No superadmin user found. Please create a superadmin user first.');
    }
    
    console.log(`Using admin ID: ${adminId}\n`);
    
    // Get all registered people
    const peopleResult = await pool.query('SELECT id, full_name FROM registered_people ORDER BY full_name');
    const people = peopleResult.rows;
    
    console.log(`Found ${people.length} registered people\n`);
    
    let totalInitialized = 0;
    let peopleWithMissingRecords = 0;
    
    for (const person of people) {
      // Get existing progress records for this person
      const existingRecords = await pool.query(
        'SELECT stage_number FROM progress_records WHERE person_id = $1',
        [person.id]
      );
      
      const existingStageNumbers = existingRecords.rows.map(r => r.stage_number);
      const missingStages = PROGRESS_STAGES.filter(stage => !existingStageNumbers.includes(stage.number));
      
      if (missingStages.length > 0) {
        peopleWithMissingRecords++;
        console.log(`\n${person.full_name}: Missing ${missingStages.length} milestone(s)`);
        
        for (const stage of missingStages) {
          // For milestone 18, check attendance count and set appropriately
          let isCompleted = false;
          let dateCompleted = null;
          
          if (stage.number === 18) {
            const attendanceCount = await pool.query(
              'SELECT COUNT(*) as count FROM attendance_records WHERE person_id = $1',
              [person.id]
            );
            const count = parseInt(attendanceCount.rows[0].count);
            isCompleted = count >= ATTENDANCE_GOAL;
            dateCompleted = isCompleted ? new Date().toISOString().split('T')[0] : null;
            
            console.log(`  ├─ M${stage.number.toString().padStart(2, '0')}: ${stage.name} (${count} attendances → ${isCompleted ? 'COMPLETED' : 'pending'})`);
          } else {
            console.log(`  ├─ M${stage.number.toString().padStart(2, '0')}: ${stage.name} (pending)`);
          }
          
          await pool.query(
            `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, date_completed, last_updated, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [person.id, stage.number, stage.name, isCompleted, dateCompleted, new Date().toISOString(), adminId]
          );
          
          totalInitialized++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Initialization completed!');
    console.log(`✅ Initialized: ${totalInitialized} milestone records`);
    console.log(`👤 People with missing records: ${peopleWithMissingRecords}`);
    console.log(`📊 Total people processed: ${people.length}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error initializing progress records:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

initializeMissingProgressRecords();
