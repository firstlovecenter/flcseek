import bcrypt from 'bcryptjs';

const password = 'admin123';
const hash = bcrypt.hashSync(password, 10);

console.log('Bcrypt hash for "admin123":');
console.log(hash);
