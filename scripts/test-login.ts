import { query } from '../lib/neon';
import { verifyPassword, generateToken } from '../lib/auth';

async function testLogin() {
  try {
    const username = 'january_admin';
    const password = 'JanuaryAdmin2025!';

    console.log('Testing login for:', username);

    // Get user from database
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found:', {
      id: user.id,
      username: user.username,
      role: user.role,
      group_name: user.group_name,
      group_id: user.group_id
    });

    // Verify password
    const isValidPassword = verifyPassword(password, user.password);

    if (!isValidPassword) {
      console.error('❌ Invalid password');
      process.exit(1);
    }

    console.log('✅ Password verified');

    // Get user's group information
    let groupName = user.group_name || null;
    let groupYear = null;
    let groupId = user.group_id || null;

    // For admins and leaders who are assigned to a monthly group
    if ((user.role === 'admin' || user.role === 'leader') && !groupId) {
      const groupResult = await query(
        'SELECT id, name FROM groups WHERE sheep_seeker_id = $1',
        [user.id]
      );
      if (groupResult.rows.length > 0) {
        groupId = groupResult.rows[0].id;
        groupName = groupResult.rows[0].name;
        groupYear = 2025; // Default year
      }
    }

    // Get group name and year if we have group_id
    if (groupId && !groupName) {
      const groupResult = await query(
        'SELECT name FROM groups WHERE id = $1',
        [groupId]
      );
      if (groupResult.rows.length > 0) {
        groupName = groupResult.rows[0].name;
        groupYear = 2025; // Default year
      }
    }

    console.log('✅ Group info:', { groupName, groupYear, groupId });

    // Generate token
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email || undefined,
      role: user.role,
      group_name: groupName || undefined,
      group_year: groupYear || undefined,
      group_id: groupId || undefined,
    });

    console.log('✅ Token generated successfully');

    console.log('\n✅ LOGIN TEST PASSED!');
    console.log('\nUser object that would be returned:');
    console.log({
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      group_name: groupName,
      group_year: groupYear,
      group_id: groupId,
      phone_number: user.phone_number,
    });

  } catch (error) {
    console.error('❌ Login test failed:', error);
    process.exit(1);
  }
}

testLogin()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
