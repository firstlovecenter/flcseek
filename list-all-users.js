const { neon } = require('@neondatabase/serverless');

if (!process.env.NEON_DATABASE_URL) {
  console.error('❌ Error: NEON_DATABASE_URL environment variable is not set');
  console.error('Please set NEON_DATABASE_URL in your .env file');
  process.exit(1);
}

const sql = neon(process.env.NEON_DATABASE_URL);

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
