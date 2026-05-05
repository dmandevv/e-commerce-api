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
const MONGODB_URI = process.env.MONGODB_URI || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

/** Build a connection URI for a specific database.
 *  Handles both Atlas (mongodb+srv) and local Docker (mongodb://) URIs.
 *  For local Docker, adds authSource=admin so the root user can auth
 *  against per-service databases. */
function buildDbUri(base: string, dbName: string): string {
  const url = new URL(base);
  url.pathname = '/' + dbName;
  if (!base.includes('mongodb+srv') && !url.searchParams.has('authSource')) {
    url.searchParams.set('authSource', 'admin');
  }
  return url.toString();
}

// ─── Safety Guard ────────────────────────────────────────
const isProduction = MONGODB_URI.includes('mongodb+srv');
const isFreshSeed = process.argv.includes('--fresh');

if (isProduction && isFreshSeed) {
  console.error('❌ SAFETY: Refusing to run --fresh seed on production database!');
  console.error('   To re-seed production, set: CONFIRM_PRODUCTION_SEED=true');
  console.error('   Then run: CONFIRM_PRODUCTION_SEED=true npx tsx scripts/seed.ts --fresh');

  if (!process.env.CONFIRM_PRODUCTION_SEED) {
    process.exit(1);
  }

  console.warn('⚠️  WARNING: Proceeding with --fresh seed on PRODUCTION database!');
}

// ─── Products ────────────────────────────────────────────
const products = [
  {
    name: 'Sony WH-1000XM5 Headphones',
    description: 'Industry-leading noise cancellation with Auto NC Optimizer, crystal-clear hands-free calling, and up to 30 hours of battery life.',
    price: 348.0,
    category: 'Electronics',
    variants: [
      { sku: 'SONY-XM5-BLK', attributes: { color: 'Black' }, stock: 30, reservedStock: 0 },
      { sku: 'SONY-XM5-SLV', attributes: { color: 'Silver' }, stock: 15, reservedStock: 0 },
    ],
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
    category: 'Electronics',
    variants: [{ sku: 'CANON-R6II-BODY', attributes: {}, stock: 12, reservedStock: 0 }],
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
    category: 'Computers',
    variants: [
      { sku: 'MBP16-M3PRO-18-512', attributes: { memory: '18GB', storage: '512GB' }, stock: 12, reservedStock: 0 },
      { sku: 'MBP16-M3PRO-36-512', attributes: { memory: '36GB', storage: '512GB' }, stock: 8, reservedStock: 0 },
    ],
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
    category: 'Electronics',
    variants: [
      { sku: 'MX-MASTER-3S-GRY', attributes: { color: 'Graphite' }, stock: 80, reservedStock: 0 },
      { sku: 'MX-MASTER-3S-WHT', attributes: { color: 'Pale Grey' }, stock: 70, reservedStock: 0 },
    ],
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
    variants: [
      { sku: 'S24U-256-BLK', attributes: { color: 'Titanium Black', storage: '256GB' }, stock: 15, reservedStock: 0 },
      { sku: 'S24U-512-VIO', attributes: { color: 'Titanium Violet', storage: '512GB' }, stock: 15, reservedStock: 0 },
    ],
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
    category: 'Electronics',
    variants: [{ sku: 'SONY-A7IV-BODY', attributes: {}, stock: 8, reservedStock: 0 }],
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
    category: 'Computers',
    variants: [
      { sku: 'X1C-I7-16-512', attributes: { memory: '16GB', storage: '512GB' }, stock: 15, reservedStock: 0 },
      { sku: 'X1C-I7-32-1TB', attributes: { memory: '32GB', storage: '1TB' }, stock: 10, reservedStock: 0 },
    ],
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
    variants: [{ sku: 'APP2-WHT', attributes: { color: 'White' }, stock: 100, reservedStock: 0 }],
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
    category: 'Electronics',
    variants: [
      { sku: 'Q1PRO-BRN-BLK', attributes: { switch: 'Brown', color: 'Black' }, stock: 30, reservedStock: 0 },
      { sku: 'Q1PRO-RED-BLK', attributes: { switch: 'Red', color: 'Black' }, stock: 30, reservedStock: 0 },
    ],
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
    category: 'Food & Grocery',
    variants: [
      { sku: 'COFFEE-DARK-1LB', attributes: { size: '1 lb' }, stock: 120, reservedStock: 0 },
      { sku: 'COFFEE-DARK-2LB', attributes: { size: '2 lb' }, stock: 80, reservedStock: 0 },
    ],
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
  const userConn = await mongoose.createConnection(buildDbUri(MONGODB_URI, 'user-service')).asPromise();
  const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'customer' },
  }, { timestamps: true });
  const User = userConn.model('User', UserSchema);

  // Upsert: create admin if missing, reset password if exists.
  // This makes the seed idempotent — run it anytime to reset
  // the admin to a known password. No more locked-out admins.
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { name: ADMIN_NAME, password: hashedPassword, role: 'admin' },
    { upsert: true, new: true },
  );
  console.log(`✓ Admin user upserted (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`);

  // --- Products ---
  const productConn = await mongoose.createConnection(buildDbUri(MONGODB_URI, 'product-service')).asPromise();
  const ProductSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    category: String,
    variants: [{ sku: String, attributes: Map, stock: Number, reservedStock: { type: Number, default: 0 }, price: Number }],
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

  // Map product names to Cloudinary image URLs
  const productImages: Record<string, string> = {
    'Sony WH-1000XM5 Headphones': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775294969/headphones_q43kpt.jpg',
    'Canon EOS R6 Mark II': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775295634/jon-tyson-ufBQap6j1lg-unsplash_mxromk.jpg',
    'MacBook Pro 16" M3 Pro': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775295263/kari-shea-1SAnrIxw5OY-unsplash_1_tervet.jpg',
    'Logitech MX Master 3S': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775296914/luka-petranovic-UihqZIiVcxY-unsplash_jfmvkr.jpg',
    'Samsung Galaxy S24 Ultra': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775296833/dhruv-vishwakarma-Eda49vVHnp0-unsplash_btr19u.jpg',
    'Sony A7 IV Camera': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775295868/mathias-reding-9uY9MpS4HNI-unsplash_bjk4si.jpg',
    'Lenovo ThinkPad X1 Carbon Gen 11': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775295733/gavin-phillips-KFkikBO02pY-unsplash_1_wkfsan.jpg',
    'Apple AirPods Pro 2': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775295825/insung-yoon-mru38VH7tII-unsplash_f2ctkv.jpg',
    'Keychron Q1 Pro Mechanical Keyboard': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775295363/florian-krumm-1osIUArK5oA-unsplash_mz8k7e.jpg',
    'Organic Dark Roast Coffee Beans (2 lb)': 'https://res.cloudinary.com/dmandevv-ecommerce/image/upload/v1775295383/mike-kenneally-TD4DBagg2wE-unsplash_acw1af.jpg',
  };

  const productsWithCreator = products.map((p) => ({
    ...p,
    createdBy: adminId,
    images: [{ publicId: `seed/${p.name}`, url: productImages[p.name] || 'https://via.placeholder.com/300x300.png?text=' + encodeURIComponent(p.name) }],
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
