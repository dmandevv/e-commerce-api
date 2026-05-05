import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI is required (inject with Doppler)!');
    process.exit(1);
}

function buildDbUri(base: string, dbName: string): string {
  const url = new URL(base);
  url.pathname = '/' + dbName;
  if (!base.includes('mongodb+srv') && !url.searchParams.has('authSource')) {
    url.searchParams.set('authSource', 'admin');
  }
  return url.toString();
}

async function migrate() {
  console.log('🔄 Migrating products to variant model...\n');

  const conn = await mongoose.createConnection(buildDbUri(MONGODB_URI!, 'product-service')).asPromise();

  const ProductSchema = new mongoose.Schema({
    name: String,
    stock: Number,
    variants: { type: Array, default: [] },
  }, { strict: false, timestamps: true });

  const Product = conn.model('Product', ProductSchema);

  const products = await Product.find({ variants: { $size: 0 }, stock: { $exists: true } });
  console.log(`Found ${products.length} products to migrate`);

  for (const product of products) {
    const stock = (product as any).stock ?? 0;
    const sku = (product as any).name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 20);

    await Product.findByIdAndUpdate(product._id, {
      $set: {
        variants: [{ sku, attributes: {}, stock, reservedStock: 0 }],
      },
    });

    console.log(`✓ ${(product as any).name}`);
  }

  await conn.close();
  console.log('\n✅ Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
