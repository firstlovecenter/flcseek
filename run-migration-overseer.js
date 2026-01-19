const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const sqlFile = path.join(__dirname, 'prisma', 'migrations', '016_add_overseer_role.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  console.log('Executing migration SQL directly on Neon database...\n');
  console.log('SQL Commands:');
  console.log('─'.repeat(60));
  console.log(sql);
  console.log('─'.repeat(60));
  console.log('\n⚠️  Please execute the SQL above manually in your Neon dashboard:');
  console.log('1. Go to https://console.neon.tech');
  console.log('2. Select your project and database');
  console.log('3. Open the SQL Editor');
  console.log('4. Paste the SQL commands above');
  console.log('5. Click "Execute"');
  console.log('\nAlternatively, you can run it with psql if you have it installed.');
}

runMigration();
