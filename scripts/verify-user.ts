import mongoose from 'mongoose';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx ts-node scripts/verify-user.ts <email>');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

function buildDbUri(base: string, dbName: string): string {
  const url = new URL(base);
  url.pathname = '/' + dbName;
  return url.toString();
}

async function run() {
  const conn = await mongoose.createConnection(buildDbUri(MONGODB_URI!, 'user-service')).asPromise();

  const User = conn.model('User', new mongoose.Schema({
    email: String,
    emailVerified: Boolean,
  }, { strict: false }));

  const result = await User.findOneAndUpdate(
    { email },
    { $set: { emailVerified: true } },
    { new: true }
  );

  if (!result) {
    console.error(`No user found with email: ${email}`);
    await conn.close();
    process.exit(1);
  }

  console.log(`✓ Verified ${email}`);
  await conn.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
