const { neon } = require('@neondatabase/serverless');

if (!process.env.NEON_DATABASE_URL) {
  console.error('❌ Error: NEON_DATABASE_URL environment variable is not set');
  console.error('Please set NEON_DATABASE_URL in your .env file');
  process.exit(1);
}

const sql = neon(process.env.NEON_DATABASE_URL);

async function createSysadmin() {
  try {
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
        '$2b$10$Xpe929tiCklxkmXHi98bTeJYXdyfbPbphFfYzZa8fIROl/Woo4Ro2',
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
    console.log('\nLogin credentials:');
    console.log('Username: sysadmin');
    console.log('Password: @sysadmin123');
  } catch (error) {
    console.error('❌ Error creating sysadmin user:', error.message);
  }
}

createSysadmin();
