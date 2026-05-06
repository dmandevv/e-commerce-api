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

  // Phase 1: products with no variants at all
  const productsWithoutVariants = await Product.find({
    $or: [{ variants: { $exists: false } }, { variants: { $size: 0 } }],
    stock: { $exists: true },
  });
  console.log(`Phase 1: ${productsWithoutVariants.length} products with no variants`);

  for (const product of productsWithoutVariants) {
    const stock = (product as any).stock ?? 0;
    const sku = (product as any).name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 20);

    await Product.findByIdAndUpdate(product._id, {
      $set: {
        variants: [{ sku, attributes: {}, stock, reservedStock: 0, price: (product as any).price }],
      },
    });

    console.log(`  ✓ ${(product as any).name}`);
  }

  // Phase 2: products with variants that are missing the price field
  const productsWithPricelessVariants = await Product.find({
    'variants.0': { $exists: true },           // has at least one variant
    'variants.price': { $exists: false },       // but none have price set
  });
  console.log(`Phase 2: ${productsWithPricelessVariants.length} products with variants missing price`);

  for (const product of productsWithPricelessVariants) {
    const productPrice = (product as any).price;
    const updatedVariants = ((product as any).variants as any[]).map((v: any) => ({
      ...v,
      price: v.price ?? productPrice,
    }));

    await Product.findByIdAndUpdate(product._id, {
      $set: { variants: updatedVariants },
    });

    console.log(`  ✓ ${(product as any).name} — set price $${productPrice} on ${updatedVariants.length} variant(s)`);
  }

  await conn.close();
  console.log('\n✅ Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
