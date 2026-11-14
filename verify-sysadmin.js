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

async function verifySysadmin() {
  try {
    // Check if user exists
    const result = await sql`
      SELECT id, username, role, password, email, created_at
      FROM users
      WHERE username = 'sysadmin'
    `;
    
    if (result.length === 0) {
      console.log('❌ User "sysadmin" not found in database');
      return;
    }
    
    console.log('✅ User found:');
    console.log('ID:', result[0].id);
    console.log('Username:', result[0].username);
    console.log('Role:', result[0].role);
    console.log('Email:', result[0].email);
    console.log('Created:', result[0].created_at);
    console.log('\nStored password hash:', result[0].password);
    
    // Test password
    const isValid = await bcrypt.compare(password, result[0].password);

    console.log('\n🔐 Password verification:');
    console.log('Match:', isValid ? '✅ YES' : '❌ NO');

    if (!isValid) {
      console.log('\n⚠️  Password does not match. Updating to correct hash...');
      const newHash = await bcrypt.hash(password, 10);

      await sql`
        UPDATE users
        SET password = ${newHash}
        WHERE username = 'sysadmin'
      `;

      console.log('✅ Password updated successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifySysadmin();
