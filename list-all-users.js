const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_xRuCd9bPYU5p@ep-fragrant-haze-adwnlt5e-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

async function listAllUsers() {
  try {
    const result = await sql`
      SELECT id, username, role, email, first_name, last_name, created_at
      FROM users
      ORDER BY created_at DESC
    `;
    
    console.log(`\n📋 Total users in database: ${result.length}\n`);
    
    result.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Name: ${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A');
      console.log(`   Created: ${user.created_at}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listAllUsers();
