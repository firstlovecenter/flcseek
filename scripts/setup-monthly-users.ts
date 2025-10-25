import { query } from '../lib/neon';
import { hashPassword } from '../lib/auth';
import * as fs from 'fs';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Function to generate username from month
function generateUsername(month: string, role: 'admin' | 'leader'): string {
  return `${month.toLowerCase()}_${role}`;
}

// Function to generate a simple password (month name + year)
function generatePassword(month: string, role: 'admin' | 'leader'): string {
  return `${month}${role === 'admin' ? 'Admin' : 'Leader'}2025!`;
}

async function setupMonthlyUsers() {
  try {
    console.log('✅ Starting user setup...');

    // Step 1: Delete all registered people (fresh start)
    console.log('\n�️  Deleting all registered people...');
    const deletePeopleResult = await query(
      `DELETE FROM new_converts`
    );
    console.log(`✅ Deleted ${deletePeopleResult.rowCount} registered people`);

    // Step 2: Delete all users except skaduteye@gmail.com
    console.log('\n🗑️  Deleting existing users (except skaduteye@gmail.com)...');
    const deleteResult = await query(
      `DELETE FROM users WHERE email != 'skaduteye@gmail.com' OR email IS NULL`
    );
    console.log(`✅ Deleted ${deleteResult.rowCount} users`);

    // Step 3: Get all groups (months) with their IDs
    console.log('\n📋 Fetching groups...');
    const groupsResult = await query(
      `SELECT id, name FROM groups ORDER BY name`
    );
    const groups: Array<{ id: string; name: string; year?: number }> = groupsResult.rows;
    console.log(`✅ Found ${groups.length} groups`);

    const userCredentials: Array<{
      username: string;
      password: string;
      role: string;
      group: string;
      year: number;
    }> = [];

    // Step 4: Create 12 leaders (one for each month)
    console.log('\n👥 Creating leaders for each month...');
    for (const month of months) {
      const group = groups.find(g => g.name === month);
      const username = generateUsername(month, 'leader');
      const password = generatePassword(month, 'leader');
      const hashedPassword = hashPassword(password);

      await query(
        `INSERT INTO users (username, password, role, group_name, group_id, first_name, last_name, phone_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          username,
          hashedPassword,
          'leader',
          month,
          group?.id || null,
          month,
          'Leader',
          `+233${Math.floor(Math.random() * 900000000 + 100000000)}`
        ]
      );

      userCredentials.push({
        username,
        password,
        role: 'leader',
        group: month,
        year: group?.year || 2025
      });

      console.log(`✅ Created leader: ${username}`);
    }

    // Step 5: Create 12 admins (one for each month)
    console.log('\n🔑 Creating admins for each month...');
    for (const month of months) {
      const group = groups.find(g => g.name === month);
      const username = generateUsername(month, 'admin');
      const password = generatePassword(month, 'admin');
      const hashedPassword = hashPassword(password);

      await query(
        `INSERT INTO users (username, password, role, group_name, group_id, first_name, last_name, phone_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          username,
          hashedPassword,
          'admin',
          month,
          group?.id || null,
          month,
          'Admin',
          `+233${Math.floor(Math.random() * 900000000 + 100000000)}`
        ]
      );

      userCredentials.push({
        username,
        password,
        role: 'admin',
        group: month,
        year: group?.year || 2025
      });

      console.log(`✅ Created admin: ${username}`);
    }

    // Step 6: Create lead pastor (can view all months)
    console.log('\n⛪ Creating lead pastor...');
    const leadPastorUsername = 'leadpastor';
    const leadPastorPassword = 'LeadPastor2025!';
    const leadPastorHashedPassword = hashPassword(leadPastorPassword);

    await query(
      `INSERT INTO users (username, password, role, first_name, last_name, phone_number, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        leadPastorUsername,
        leadPastorHashedPassword,
        'leadpastor',
        'Lead',
        'Pastor',
        '+233500000000',
        'leadpastor@flc.church'
      ]
    );

    userCredentials.push({
      username: leadPastorUsername,
      password: leadPastorPassword,
      role: 'leadpastor',
      group: 'All Months',
      year: 2025
    });

    console.log(`✅ Created lead pastor: ${leadPastorUsername}`);

    // Step 7: Display all credentials
    console.log('\n' + '='.repeat(80));
    console.log('📋 USER CREDENTIALS SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\n🔑 LEAD PASTOR (Can view all months):');
    console.log('─'.repeat(80));
    console.log(`Username: leadpastor`);
    console.log(`Password: LeadPastor2025!`);
    console.log(`Role: Lead Pastor (View Only)`);
    
    console.log('\n\n👥 LEADERS (View only for assigned month):');
    console.log('─'.repeat(80));
    const leaders = userCredentials.filter(u => u.role === 'leader');
    leaders.forEach(user => {
      console.log(`\nMonth: ${user.group} ${user.year}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Password: ${user.password}`);
    });

    console.log('\n\n🔑 ADMINS (Can edit assigned month):');
    console.log('─'.repeat(80));
    const admins = userCredentials.filter(u => u.role === 'admin');
    admins.forEach(user => {
      console.log(`\nMonth: ${user.group} ${user.year}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Password: ${user.password}`);
    });

    // Step 8: Save credentials to a file
    console.log('\n\n💾 Saving credentials to file...');
    const credentialsText = `
FLCSEEK USER CREDENTIALS
========================
Generated: ${new Date().toLocaleString()}

LEAD PASTOR (Can view all months):
──────────────────────────────────
Username: leadpastor
Password: LeadPastor2025!
Role: Lead Pastor (View Only)


LEADERS (View only for assigned month):
────────────────────────────────────────
${leaders.map(u => `
${u.group} ${u.year}:
  Username: ${u.username}
  Password: ${u.password}
`).join('')}


ADMINS (Can edit assigned month):
──────────────────────────────────
${admins.map(u => `
${u.group} ${u.year}:
  Username: ${u.username}
  Password: ${u.password}
`).join('')}


SUPERADMIN (Full access):
──────────────────────────
Email: skaduteye@gmail.com
(Existing password unchanged)


NOTES:
------
- Leaders can VIEW data for their assigned month only
- Admins can EDIT data for their assigned month only
- Lead Pastor can VIEW all months but cannot edit
- Superadmin has full access to everything
- All passwords follow the pattern: MonthRole2025! (e.g., JanuaryAdmin2025!)
`;

    fs.writeFileSync('USER_CREDENTIALS.txt', credentialsText);
    console.log('✅ Credentials saved to USER_CREDENTIALS.txt');

    console.log('\n' + '='.repeat(80));
    console.log('✅ USER SETUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('\nTotal users created:');
    console.log(`  - 12 Leaders (view only)`);
    console.log(`  - 12 Admins (can edit)`);
    console.log(`  - 1 Lead Pastor (view all)`);
    console.log(`  - 1 Superadmin (existing - skaduteye@gmail.com)`);
    console.log(`\n📄 All credentials saved to: USER_CREDENTIALS.txt`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the setup
setupMonthlyUsers()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
