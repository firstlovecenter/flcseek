import 'dotenv/config';
import { query } from '../lib/neon';

// Ghanaian first names
const firstNames = {
  male: [
    'Kwame', 'Kofi', 'Kwasi', 'Kwabena', 'Yaw', 'Fiifi', 'Kweku', 'Kojo',
    'Emmanuel', 'Samuel', 'David', 'Isaac', 'Jacob', 'Daniel', 'Benjamin',
    'Joseph', 'Michael', 'Stephen', 'Paul', 'Peter', 'James', 'John',
    'Ebenezer', 'Osei', 'Mensah', 'Owusu', 'Boateng', 'Asante', 'Adjei',
    'Richmond', 'Maxwell', 'Patrick', 'Francis', 'Richard', 'Charles',
    'William', 'Henry', 'George', 'Albert', 'Ernest', 'Gilbert', 'Felix',
    'Vincent', 'Lawrence', 'Anthony', 'Augustine', 'Sebastian', 'Nicholas'
  ],
  female: [
    'Ama', 'Akosua', 'Afia', 'Abena', 'Yaa', 'Efua', 'Esi', 'Akua',
    'Grace', 'Mary', 'Sarah', 'Esther', 'Ruth', 'Rebecca', 'Rachel',
    'Hannah', 'Abigail', 'Naomi', 'Elizabeth', 'Martha', 'Lydia',
    'Priscilla', 'Deborah', 'Joanna', 'Eunice', 'Dorcas', 'Rhoda',
    'Joyce', 'Comfort', 'Patience', 'Beatrice', 'Florence', 'Victoria',
    'Agnes', 'Felicia', 'Gloria', 'Rose', 'Janet', 'Linda', 'Margaret',
    'Catherine', 'Patricia', 'Sandra', 'Monica', 'Stella', 'Diana', 'Alice'
  ]
};

// Ghanaian surnames
const surnames = [
  'Mensah', 'Boateng', 'Owusu', 'Asante', 'Agyei', 'Adjei', 'Osei',
  'Amoako', 'Ampofo', 'Appiah', 'Acheampong', 'Adom', 'Afful', 'Akoto',
  'Antwi', 'Ansah', 'Asare', 'Baffoe', 'Bonsu', 'Gyasi', 'Kwarteng',
  'Ofori', 'Opoku', 'Poku', 'Sarpong', 'Yeboah', 'Danso', 'Frimpong',
  'Gyamfi', 'Tetteh', 'Oduro', 'Afriyie', 'Akuoko', 'Wiredu', 'Nimako',
  'Kusi', 'Donkor', 'Bamfo', 'Siaw', 'Nkrumah', 'Quartey', 'Hammond',
  'Darko', 'Forson', 'Essien', 'Nyarko', 'Amoah', 'Obeng', 'Agyapong'
];

// Accra neighborhoods
const accraLocations = [
  'Madina', 'Adenta', 'Dome', 'Ashongman', 'Taifa', 'Oyibi', 'Kwabenya',
  'Achimota', 'Lapaz', 'Kasoa', 'Weija', 'Dansoman', 'Mamprobi', 'Kaneshie',
  'Accra Central', 'Osu', 'Labone', 'Airport', 'Dzorwulu', 'Legon', 'Haatso',
  'Spintex', 'Tema', 'Teshie', 'Nungua', 'Lashibi', 'Sakumono', 'Michel Camp',
  'Gbawe', 'Mallam', 'Odorkor', 'Ablekuma', 'Darkuman', 'Mataheko', 'Abeka',
  'Santa Maria', 'North Kaneshie', 'Sukura', 'Bubuashie', 'Kwashieman',
  'Tetegu', 'Oblogo', 'McCarthy Hill', 'Pokuase', 'Amasaman', 'Nsawam Road'
];

// Generate random phone number
function generatePhoneNumber(): string {
  const prefixes = ['024', '054', '055', '059', '020', '050', '027', '057', '026', '056'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 9000000 + 1000000); // 7 digits
  return `+233${prefix.substring(1)}${number}`;
}

// Generate random name
function generateName(): { firstName: string; lastName: string; gender: string } {
  const gender = Math.random() > 0.5 ? 'Male' : 'Female';
  const firstName = gender === 'Male' 
    ? firstNames.male[Math.floor(Math.random() * firstNames.male.length)]
    : firstNames.female[Math.floor(Math.random() * firstNames.female.length)];
  const lastName = surnames[Math.floor(Math.random() * surnames.length)];
  
  return { firstName, lastName, gender };
}

// Generate random location
function generateLocation(): string {
  return accraLocations[Math.floor(Math.random() * accraLocations.length)];
}

async function populateDatabase() {
  try {
    console.log('🚀 Starting database population with 5000 new converts...\n');

    // Get all groups
    const groupsResult = await query(
      'SELECT id, name FROM groups ORDER BY name'
    );
    const groups = groupsResult.rows;
    console.log(`📋 Found ${groups.length} groups\n`);

    if (groups.length !== 12) {
      console.error(`❌ Expected 12 groups but found ${groups.length}`);
      process.exit(1);
    }

    // Get admin users for each group (they will be the registered_by)
    const usersResult = await query(
      `SELECT id, username, group_id FROM users WHERE role = 'admin' AND group_id IS NOT NULL`
    );
    const adminUsers = usersResult.rows;
    console.log(`👥 Found ${adminUsers.length} admin users\n`);

    const totalPeople = 5000;
    const peoplePerGroup = Math.floor(totalPeople / groups.length);
    const remainder = totalPeople % groups.length;

    let totalCreated = 0;
    const createdByGroup: { [key: string]: number } = {};

    console.log(`Creating ${peoplePerGroup} people per group (${peoplePerGroup} × 12 = ${peoplePerGroup * 12})`);
    console.log(`Plus ${remainder} extra to reach exactly ${totalPeople} total\n`);
    console.log('═'.repeat(80));

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const admin = adminUsers.find(u => u.group_id === group.id);
      
      if (!admin) {
        console.log(`⚠️  No admin found for ${group.name}, skipping...`);
        continue;
      }

      // Calculate how many people for this group (add remainder to last group)
      const countForThisGroup = peoplePerGroup + (i === groups.length - 1 ? remainder : 0);
      
      console.log(`\n📍 ${group.name} (${countForThisGroup} people)...`);

      const batchSize = 50;
      let created = 0;

      for (let batch = 0; batch < Math.ceil(countForThisGroup / batchSize); batch++) {
        const peopleInBatch = Math.min(batchSize, countForThisGroup - created);
        const values: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        for (let j = 0; j < peopleInBatch; j++) {
          const { firstName, lastName, gender } = generateName();
          const fullName = `${firstName} ${lastName}`;
          const phoneNumber = generatePhoneNumber();
          const homeLocation = generateLocation();
          const workLocation = Math.random() > 0.3 ? generateLocation() : homeLocation;

          values.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
          );
          params.push(fullName, phoneNumber, gender, group.name, group.id, admin.id, homeLocation, workLocation);
          paramIndex += 8;
        }

        const insertQuery = `
          INSERT INTO registered_people 
          (full_name, phone_number, gender, group_name, group_id, registered_by, home_location, work_location)
          VALUES ${values.join(', ')}
        `;

        await query(insertQuery, params);
        created += peopleInBatch;
        totalCreated += peopleInBatch;

        process.stdout.write(`  ✅ Progress: ${created}/${countForThisGroup} (${Math.round(created/countForThisGroup*100)}%)\r`);
      }

      console.log(`  ✅ Completed: ${created}/${countForThisGroup} people created`);
      createdByGroup[group.name] = created;
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ DATABASE POPULATION COMPLETED!\n');

    // Summary
    console.log('📊 SUMMARY BY GROUP:');
    console.log('─'.repeat(80));
    Object.entries(createdByGroup).forEach(([groupName, count]) => {
      console.log(`${groupName.padEnd(20)} : ${count.toString().padStart(4)} people`);
    });
    console.log('─'.repeat(80));
    console.log(`${'TOTAL'.padEnd(20)} : ${totalCreated.toString().padStart(4)} people\n`);

    // Verify
    const verifyResult = await query(
      'SELECT COUNT(*) as total FROM registered_people'
    );
    console.log(`🔍 Database verification: ${verifyResult.rows[0].total} people in database`);

    if (parseInt(verifyResult.rows[0].total) === totalPeople) {
      console.log('✅ Verification successful! All people created correctly.\n');
    } else {
      console.log(`⚠️  Warning: Expected ${totalPeople} but found ${verifyResult.rows[0].total}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

populateDatabase()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
