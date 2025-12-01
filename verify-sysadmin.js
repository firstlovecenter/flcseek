const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

const sql = neon(process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_xRuCd9bPYU5p@ep-fragrant-haze-adwnlt5e-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

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
    const testPassword = '@sysadmin123';
    const isValid = await bcrypt.compare(testPassword, result[0].password);
    
    console.log('\n🔐 Password verification:');
    console.log('Testing password:', testPassword);
    console.log('Match:', isValid ? '✅ YES' : '❌ NO');
    
    if (!isValid) {
      console.log('\n⚠️  Password does not match. Updating to correct hash...');
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('New hash:', newHash);
      
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
