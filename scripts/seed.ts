/**
 * Database Seed Script
 *
 * Populates MongoDB with an admin user and realistic product catalog.
 * Run: npx tsx scripts/seed.ts
 *
 * Uses the same connection strings as the services, so it works both
 * locally (Docker Compose) and against production (set env vars).
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ─── Config ──────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:admin_password@localhost:27017';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dev@dmandevv.shop';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

// ─── Products ────────────────────────────────────────────
const products = [
  {
    name: 'Sony WH-1000XM5 Headphones',
    description: 'Industry-leading noise cancellation with Auto NC Optimizer, crystal-clear hands-free calling, and up to 30 hours of battery life.',
    price: 348.0,
    category: 'Electronics',
    stock: 45,
    rating: 4.7,
    numOfReviews: 3,
    reviews: [
      { userId: 'seed', name: 'Alex M.', rating: 5, comment: 'Best noise cancellation I\'ve ever experienced.' },
      { userId: 'seed', name: 'Jordan K.', rating: 4, comment: 'Great sound quality, but the touch controls are finnicky.' },
      { userId: 'seed', name: 'Sam R.', rating: 5, comment: 'Worth every penny. My daily driver for WFH.' },
    ],
  },
  {
    name: 'Canon EOS R6 Mark II',
    description: 'Full-frame mirrorless camera with 24.2 MP sensor, 4K 60p video, and subject detection AF. Perfect for photos and video.',
    price: 2499.0,
    category: 'Cameras',
    stock: 12,
    rating: 4.8,
    numOfReviews: 2,
    reviews: [
      { userId: 'seed', name: 'Chris P.', rating: 5, comment: 'The autofocus is incredible. Tracks eyes even in low light.' },
      { userId: 'seed', name: 'Taylor W.', rating: 5, comment: 'Upgraded from the R6 — the improvements are noticeable.' },
    ],
  },
  {
    name: 'MacBook Pro 16" M3 Pro',
    description: '16-inch Liquid Retina XDR display, M3 Pro chip, 18GB unified memory, 512GB SSD. Built for professional workflows.',
    price: 2499.0,
    category: 'Laptops',
    stock: 20,
    rating: 4.9,
    numOfReviews: 2,
    reviews: [
      { userId: 'seed', name: 'Dev Team', rating: 5, comment: 'Compiles our monorepo in half the time. Battery lasts all day.' },
      { userId: 'seed', name: 'Morgan L.', rating: 5, comment: 'The screen is gorgeous for photo editing.' },
    ],
  },
  {
    name: 'Logitech MX Master 3S',
    description: 'Wireless ergonomic mouse with 8K DPI tracking, quiet clicks, and MagSpeed scroll wheel. Works on any surface.',
    price: 99.99,
    category: 'Accessories',
    stock: 150,
    rating: 4.6,
    numOfReviews: 4,
    reviews: [
      { userId: 'seed', name: 'Pat N.', rating: 5, comment: 'The scroll wheel alone is worth the price.' },
      { userId: 'seed', name: 'Riley T.', rating: 4, comment: 'Comfortable for long sessions, but Bluetooth can lag.' },
      { userId: 'seed', name: 'Quinn D.', rating: 5, comment: 'Paired with three devices seamlessly.' },
      { userId: 'seed', name: 'Casey B.', rating: 4, comment: 'Great mouse, wish it was USB-C to charge though. Oh wait, it is!' },
    ],
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    description: 'Titanium build, 200MP camera, S Pen built-in, Snapdragon 8 Gen 3, 5000mAh battery. The ultimate Android phone.',
    price: 1299.99,
    category: 'Electronics',
    stock: 30,
    rating: 4.5,
    numOfReviews: 3,
    reviews: [
      { userId: 'seed', name: 'Jamie R.', rating: 5, comment: 'Camera is insane. Night mode rivals dedicated cameras.' },
      { userId: 'seed', name: 'Avery S.', rating: 4, comment: 'Battery life could be better with the QHD display on.' },
      { userId: 'seed', name: 'Drew H.', rating: 5, comment: 'The S Pen integration is underrated.' },
    ],
  },
  {
    name: 'Sony A7 IV Camera',
    description: '33MP full-frame sensor, 4K 60p, real-time Eye AF, 10fps burst shooting. The hybrid camera for stills and video.',
    price: 2498.0,
    category: 'Cameras',
    stock: 8,
    rating: 4.7,
    numOfReviews: 1,
    reviews: [
      { userId: 'seed', name: 'Kai L.', rating: 5, comment: 'The best all-around camera you can buy at this price.' },
    ],
  },
  {
    name: 'Lenovo ThinkPad X1 Carbon Gen 11',
    description: '14-inch 2.8K OLED display, Intel i7-1365U, 16GB RAM, 512GB SSD. 2.48 lbs. The business ultrabook standard.',
    price: 1649.0,
    category: 'Laptops',
    stock: 25,
    rating: 4.4,
    numOfReviews: 2,
    reviews: [
      { userId: 'seed', name: 'Jordan M.', rating: 4, comment: 'Best keyboard on any laptop. Period.' },
      { userId: 'seed', name: 'Alex C.', rating: 5, comment: 'Light enough for travel, powerful enough for dev work.' },
    ],
  },
  {
    name: 'Apple AirPods Pro 2',
    description: 'Active noise cancellation, adaptive transparency, personalized spatial audio, MagSafe charging case with speaker and lanyard loop.',
    price: 249.0,
    category: 'Electronics',
    stock: 100,
    rating: 4.6,
    numOfReviews: 3,
    reviews: [
      { userId: 'seed', name: 'Sam T.', rating: 5, comment: 'The adaptive transparency mode is magic.' },
      { userId: 'seed', name: 'Robin P.', rating: 4, comment: 'Sound quality is great but doesn\'t beat over-ear cans.' },
      { userId: 'seed', name: 'Morgan W.', rating: 5, comment: 'Find My on the case has already saved me once.' },
    ],
  },
  {
    name: 'Keychron Q1 Pro Mechanical Keyboard',
    description: 'Wireless 75% layout, Gateron Jupiter Brown switches, QMK/VIA compatible, full aluminum body, hot-swappable.',
    price: 199.0,
    category: 'Accessories',
    stock: 60,
    rating: 4.8,
    numOfReviews: 2,
    reviews: [
      { userId: 'seed', name: 'Dev User', rating: 5, comment: 'VIA support is a game-changer for custom layouts.' },
      { userId: 'seed', name: 'Tyler K.', rating: 5, comment: 'Build quality is phenomenal for the price.' },
    ],
  },
  {
    name: 'Organic Dark Roast Coffee Beans (2 lb)',
    description: 'Single-origin Peruvian dark roast. Fair trade, USDA organic. Rich chocolate and caramel notes with low acidity.',
    price: 24.99,
    category: 'Food',
    stock: 200,
    rating: 4.3,
    numOfReviews: 2,
    reviews: [
      { userId: 'seed', name: 'Coffee Lover', rating: 4, comment: 'Smooth for a dark roast. Great for cold brew.' },
      { userId: 'seed', name: 'Bailey R.', rating: 5, comment: 'My new daily driver. Low acidity is a big plus.' },
    ],
  },
];

// ─── Seed Logic ──────────────────────────────────────────
async function seed() {
  console.log('🌱 Starting database seed...\n');

  // --- Admin User ---
  const userConn = await mongoose.createConnection(`${MONGO_URI}/user-service?authSource=admin`).asPromise();
  const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'customer' },
  }, { timestamps: true });
  const User = userConn.model('User', UserSchema);

  const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
  if (existingAdmin) {
    console.log(`✓ Admin user already exists (${ADMIN_EMAIL})`);
  } else {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
    });
    console.log(`✓ Admin user created (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`);
  }

  // --- Products ---
  const productConn = await mongoose.createConnection(`${MONGO_URI}/product-service?authSource=admin`).asPromise();
  const ProductSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    category: String,
    stock: Number,
    images: [{ publicId: String, url: String }],
    reviews: [{ userId: String, name: String, rating: Number, comment: String }],
    rating: { type: Number, default: 0 },
    numOfReviews: { type: Number, default: 0 },
    createdBy: String,
  }, { timestamps: true });
  const Product = productConn.model('Product', ProductSchema);

  const existingCount = await Product.countDocuments();
  if (existingCount > 0) {
    console.log(`✓ Products already seeded (${existingCount} found). Skipping.`);
    console.log('  To re-seed, run: npx tsx scripts/seed.ts --fresh');

    if (process.argv.includes('--fresh')) {
      await Product.deleteMany({});
      console.log('  Cleared existing products.');
    } else {
      await userConn.close();
      await productConn.close();
      console.log('\n✅ Seed complete.');
      process.exit(0);
    }
  }

  // Get admin user ID for createdBy
  const admin = await User.findOne({ email: ADMIN_EMAIL });
  const adminId = admin?._id?.toString() || 'seed-admin';

  const productsWithCreator = products.map((p) => ({
    ...p,
    createdBy: adminId,
    images: [{ publicId: 'placeholder', url: 'https://via.placeholder.com/300x300.png?text=' + encodeURIComponent(p.name) }],
  }));

  await Product.insertMany(productsWithCreator);
  console.log(`✓ ${products.length} products seeded`);

  // --- Cleanup ---
  await userConn.close();
  await productConn.close();

  console.log('\n✅ Seed complete.');
  console.log(`\n  Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('  Products: 10 items across 5 categories');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
