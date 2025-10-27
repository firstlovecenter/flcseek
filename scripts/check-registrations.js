// Quick check script for recent registrations
const https = require('https');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: '.env' });

const DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ NEON_DATABASE_URL not found in environment');
  process.exit(1);
}

// Parse Neon connection string
const url = new URL(DATABASE_URL);
const connectionString = {
  host: url.hostname,
  port: url.port || 5432,
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
};

console.log('🔍 Checking February bulk registrations...\n');
console.log('Database:', connectionString.database);
console.log('Host:', connectionString.host);
console.log('');

// Use neon-serverless for the query
const { neon } = require('@neondatabase/serverless');
const sql = neon(DATABASE_URL);

async function checkRegistrations() {
  try {
    // 1. Check February groups
    console.log('1️⃣ Checking February groups:');
    const februaryGroups = await sql`
      SELECT id, name, year, archived 
      FROM groups 
      WHERE LOWER(name) LIKE '%february%'
      ORDER BY year DESC
    `;
    
    if (februaryGroups.length === 0) {
      console.log('   ⚠️  No February groups found!');
    } else {
      februaryGroups.forEach(group => {
        console.log(`   ✓ Group: ${group.name} (Year: ${group.year}) - ID: ${group.id} - Archived: ${group.archived}`);
      });
    }
    console.log('');

    // 2. Check recent registrations
    console.log('2️⃣ Checking recent registrations (last 24 hours):');
    const recentRegistrations = await sql`
      SELECT 
        nc.id,
        nc.first_name,
        nc.last_name,
        nc.phone_number,
        nc.group_name,
        nc.group_id,
        nc.created_at,
        g.name as group_name_from_table,
        g.archived as group_archived
      FROM new_converts nc
      LEFT JOIN groups g ON nc.group_id = g.id
      WHERE nc.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY nc.created_at DESC
    `;

    if (recentRegistrations.length === 0) {
      console.log('   ⚠️  No registrations in the last 24 hours');
    } else {
      console.log(`   ✓ Found ${recentRegistrations.length} recent registration(s):`);
      for (const person of recentRegistrations) {
        console.log(`     - ${person.first_name} ${person.last_name}`);
        console.log(`       Phone: ${person.phone_number}`);
        console.log(`       Group: ${person.group_name || person.group_name_from_table} (ID: ${person.group_id})`);
        console.log(`       Group Archived: ${person.group_archived}`);
        console.log(`       Registered: ${person.created_at}`);
        console.log('');
      }

      // 3. Check progress records
      console.log('3️⃣ Checking progress records for recent registrations:');
      
      for (const person of recentRegistrations) {
        const progressCount = await sql`
          SELECT COUNT(*) as count
          FROM progress_records
          WHERE person_id = ${person.id}
        `;

        const count = parseInt(progressCount[0].count);
        if (count === 0) {
          console.log(`   ❌ ${person.first_name} ${person.last_name} - NO progress records!`);
        } else {
          console.log(`   ✓ ${person.first_name} ${person.last_name} - ${count} progress record(s)`);
        }
      }
      console.log('');
    }

    // 4. Check milestones
    console.log('4️⃣ Checking milestones configuration:');
    const milestones = await sql`SELECT COUNT(*) as count FROM milestones`;
    console.log(`   ✓ Total milestones in database: ${milestones[0].count}`);
    console.log('');

    // 5. Check for people without progress records
    console.log('5️⃣ Checking for people without progress records:');
    const peopleWithoutProgress = await sql`
      SELECT 
        nc.id,
        nc.first_name,
        nc.last_name,
        nc.group_name,
        nc.created_at
      FROM new_converts nc
      LEFT JOIN progress_records pr ON nc.id = pr.person_id
      WHERE pr.person_id IS NULL
      ORDER BY nc.created_at DESC
      LIMIT 20
    `;

    if (peopleWithoutProgress.length === 0) {
      console.log('   ✓ All people have progress records!');
    } else {
      console.log(`   ⚠️  Found ${peopleWithoutProgress.length} people without progress records:`);
      peopleWithoutProgress.forEach(person => {
        console.log(`     - ${person.first_name} ${person.last_name} (${person.group_name}) - Registered: ${person.created_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking registrations:', error);
  }
}

checkRegistrations().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
