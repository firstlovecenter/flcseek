const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_xRuCd9bPYU5p@ep-fragrant-haze-adwnlt5e-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

async function createSysadmin() {
  try {
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
    if (error.message.includes('duplicate key')) {
      console.log('❌ User "sysadmin" already exists in the database');
    } else {
      console.error('❌ Error creating sysadmin user:', error.message);
    }
  }
}

createSysadmin();
