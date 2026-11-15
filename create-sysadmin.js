const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

if (!process.env.NEON_DATABASE_URL) {
  console.error('❌ Error: NEON_DATABASE_URL environment variable is not set');
  console.error('Please set NEON_DATABASE_URL in your .env file');
  process.exit(1);
}

const password = process.env.SYSADMIN_PASSWORD;
if (!password) {
  console.error('Error: SYSADMIN_PASSWORD environment variable is required');
  process.exit(1);
}

const sql = neon(process.env.NEON_DATABASE_URL);

async function createSysadmin() {
  try {
    // Hash the password at runtime
    const passwordHash = await bcrypt.hash(password, 10);

    // First, try to delete existing sysadmin user if it exists
    try {
      await sql`DELETE FROM users WHERE username = 'sysadmin'`;
      console.log('🗑️  Deleted existing sysadmin user');
    } catch (deleteError) {
      // User doesn't exist, that's fine
    }

    const result = await sql`
      INSERT INTO users (username, password, role, phone_number, first_name, last_name, email)
      VALUES (
        'sysadmin',
        ${passwordHash},
        'superadmin',
        NULL,
        'System',
        'Admin',
        'sysadmin@firstlovecenter.com'
      )
      RETURNING id, username, role, email
    `;

    console.log('✅ Successfully created sysadmin user:');
    console.log(result[0]);
  } catch (error) {
    console.error('❌ Error creating sysadmin user:', error.message);
  }
}

createSysadmin();
