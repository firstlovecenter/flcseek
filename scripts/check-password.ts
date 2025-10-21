import 'dotenv/config';
import { query } from '../lib/neon';
import bcrypt from 'bcryptjs';

async function checkPassword() {
  try {
    const result = await query(
      'SELECT username, password FROM users WHERE username = $1',
      ['january_admin']
    );

    const user = result.rows[0];

    console.log('Username:', user.username);
    console.log('Hash from DB:', user.password);
    console.log('Hash length:', user.password.length);
    console.log('Hash starts with:', user.password.substring(0, 7));
    
    console.log('\nTesting password verification:');
    console.log('Correct password (JanuaryAdmin2025!):', bcrypt.compareSync('JanuaryAdmin2025!', user.password));
    console.log('Wrong password (wrongpassword):', bcrypt.compareSync('wrongpassword', user.password));
    
    // Test with a fresh hash
    const freshHash = bcrypt.hashSync('JanuaryAdmin2025!', 10);
    console.log('\nFresh hash test:', bcrypt.compareSync('JanuaryAdmin2025!', freshHash));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPassword()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
