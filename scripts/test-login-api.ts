import 'dotenv/config';

async function testLoginAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'january_admin',
        password: 'JanuaryAdmin2025!',
      }),
    });

    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ LOGIN SUCCESSFUL!');
    } else {
      console.log('\n❌ LOGIN FAILED');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testLoginAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
