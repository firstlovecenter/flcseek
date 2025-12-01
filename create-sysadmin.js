const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_xRuCd9bPYU5p@ep-fragrant-haze-adwnlt5e-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

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
        'REDACTED_HASH',
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
    console.log('Password: REDACTED_PASSWORD');
  } catch (error) {
    console.error('❌ Error creating sysadmin user:', error.message);
  }
}

createSysadmin();
