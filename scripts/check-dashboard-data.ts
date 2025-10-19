import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function checkDashboardData() {
  console.log('\n🔍 Checking Super Admin Dashboard Data...\n');

  try {
    // Check total registered people
    const peopleResult = await sql`
      SELECT COUNT(*) as total, group_name, COUNT(*) as count 
      FROM registered_people 
      GROUP BY group_name 
      ORDER BY group_name
    `;

    console.log('📊 People per group:');
    peopleResult.forEach((row: any) => {
      console.log(`  - ${row.group_name}: ${row.count} people`);
    });

    const totalPeople = await sql`SELECT COUNT(*) as total FROM registered_people`;
    console.log(`\n✅ Total registered people: ${totalPeople[0].total}`);

    // Check progress records
    const progressResult = await sql`
      SELECT COUNT(*) as total FROM progress_records
    `;
    console.log(`✅ Total progress records: ${progressResult[0].total}`);

    // Check attendance records
    const attendanceResult = await sql`
      SELECT COUNT(*) as total FROM attendance_records
    `;
    console.log(`✅ Total attendance records: ${attendanceResult[0].total}`);

    // Check a sample group's data
    console.log('\n📋 Sample data for January group:');
    const januaryPeople = await sql`
      SELECT id, full_name FROM registered_people WHERE group_name = 'January' LIMIT 3
    `;
    
    if (januaryPeople.length > 0) {
      console.log(`  Found ${januaryPeople.length} people in January`);
      
      for (const person of januaryPeople) {
        const progress = await sql`
          SELECT COUNT(*) as total, SUM(CASE WHEN is_completed = true THEN 1 ELSE 0 END) as completed
          FROM progress_records 
          WHERE person_id = ${person.id}
        `;
        
        const attendance = await sql`
          SELECT COUNT(*) as count FROM attendance_records WHERE person_id = ${person.id}
        `;
        
        console.log(`  - ${person.full_name}: ${progress[0].completed}/${progress[0].total} stages, ${attendance[0].count} attendance`);
      }
    } else {
      console.log('  ⚠️  No people found in January group');
    }

    // Check if department_name column exists (old schema)
    console.log('\n🔍 Checking table schema...');
    const schemaCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'registered_people' 
      AND column_name IN ('group_name', 'department_name')
    `;
    
    console.log('  Columns found:', schemaCheck.map((c: any) => c.column_name).join(', '));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDashboardData();
