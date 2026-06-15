const dotenv = require('dotenv');
const path = require('path');
const { createPrivateKey, createPublicKey } = require('crypto');

const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

console.log('JWT_PRIVATE_KEY exists:', !!process.env.JWT_PRIVATE_KEY);
if (process.env.JWT_PRIVATE_KEY) {
  console.log('Length:', process.env.JWT_PRIVATE_KEY.length);
  console.log('Includes BEGIN:', process.env.JWT_PRIVATE_KEY.includes('BEGIN'));
  try {
    const key = createPrivateKey({ format: 'pem', key: process.env.JWT_PRIVATE_KEY.trim() });
    console.log('Private key loaded successfully!');
  } catch (err) {
    console.log('Private key load FAILED:', err.message);
  }
}

console.log('JWT_PUBLIC_KEY exists:', !!process.env.JWT_PUBLIC_KEY);
if (process.env.JWT_PUBLIC_KEY) {
  console.log('Length:', process.env.JWT_PUBLIC_KEY.length);
  console.log('Includes BEGIN:', process.env.JWT_PUBLIC_KEY.includes('BEGIN'));
  try {
    const key = createPublicKey({ format: 'pem', key: process.env.JWT_PUBLIC_KEY.trim() });
    console.log('Public key loaded successfully!');
  } catch (err) {
    console.log('Public key load FAILED:', err.message);
  }
}
