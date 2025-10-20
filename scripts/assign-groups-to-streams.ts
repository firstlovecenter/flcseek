import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function assignGroupsToStreams() {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ No database connection string found');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🔄 Assigning existing groups to streams...\n');

    // Step 1: Create default streams
    console.log('Step 1: Creating default streams...');
    
    const defaultStreams = [
      {
        name: 'HGE Stream',
        description: 'Home Grown Experience - Main stream for existing HGE groups'
      },
      {
        name: 'eXp Stream',
        description: 'Experience stream for existing eXp groups'
      }
    ];

    const createdStreams: any[] = [];

    for (const stream of defaultStreams) {
      const result = await pool.query(
        `INSERT INTO streams (name, description, stream_leader_id)
         VALUES ($1, $2, NULL)
         RETURNING id, name`,
        [stream.name, stream.description]
      );
      
      createdStreams.push(result.rows[0]);
      console.log(`  ✅ Created: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
    }

    // Step 2: Assign groups to streams based on their prefix
    console.log('\nStep 2: Assigning groups to streams...');
    
    // Get HGE stream
    const hgeStream = createdStreams.find(s => s.name === 'HGE Stream');
    const expStream = createdStreams.find(s => s.name === 'eXp Stream');

    // Assign HGE groups
    const hgeResult = await pool.query(
      `UPDATE groups 
       SET stream_id = $1
       WHERE name LIKE 'HGE-%'
       RETURNING id, name`,
      [hgeStream.id]
    );

    console.log(`  ✅ Assigned ${hgeResult.rows.length} HGE groups to HGE Stream`);
    hgeResult.rows.forEach(g => console.log(`     - ${g.name}`));

    // Assign eXp groups
    const expResult = await pool.query(
      `UPDATE groups 
       SET stream_id = $1
       WHERE name LIKE 'eXp-%'
       RETURNING id, name`,
      [expStream.id]
    );

    console.log(`  ✅ Assigned ${expResult.rows.length} eXp groups to eXp Stream`);
    expResult.rows.forEach(g => console.log(`     - ${g.name}`));

    // Step 3: Set default dates for groups that don't have them
    console.log('\nStep 3: Setting default lifecycle dates for groups...');
    
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 6);
    const endDateStr = endDate.toISOString().split('T')[0];

    const dateResult = await pool.query(
      `UPDATE groups 
       SET start_date = $1,
           end_date = $2,
           is_active = true
       WHERE start_date IS NULL
       RETURNING id, name`,
      [startDate, endDateStr]
    );

    console.log(`  ✅ Set lifecycle dates for ${dateResult.rows.length} groups`);
    console.log(`     Start: ${startDate}`);
    console.log(`     End: ${endDateStr} (6 months from today)`);

    // Step 4: Verify the results
    console.log('\n📊 Verification:');
    
    const verification = await pool.query(`
      SELECT 
        s.name as stream_name,
        COUNT(g.id) as group_count,
        STRING_AGG(g.name, ', ' ORDER BY g.name) as group_names
      FROM streams s
      LEFT JOIN groups g ON g.stream_id = s.id
      GROUP BY s.id, s.name
      ORDER BY s.name
    `);

    verification.rows.forEach(row => {
      console.log(`\n${row.stream_name}:`);
      console.log(`  Groups: ${row.group_count}`);
      if (row.group_names) {
        console.log(`  Names: ${row.group_names}`);
      }
    });

    // Check for orphaned groups
    const orphaned = await pool.query(
      `SELECT COUNT(*) as count FROM groups WHERE stream_id IS NULL`
    );

    if (parseInt(orphaned.rows[0].count) > 0) {
      console.log(`\n⚠️  Warning: ${orphaned.rows[0].count} groups still have no stream assigned`);
    } else {
      console.log(`\n✅ All groups are now assigned to streams!`);
    }

    console.log('\n✨ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Create stream_leader users via super admin UI');
    console.log('2. Assign stream leaders to the streams');
    console.log('3. New groups created will automatically get 6-month lifecycle');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

assignGroupsToStreams();
