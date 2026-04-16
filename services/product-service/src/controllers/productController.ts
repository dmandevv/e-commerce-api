import { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { APIFeatures } from '../utils/apiFeatures.js';
import { NotFoundError, ValidationError } from '@ecommerce/shared/errors';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../utils/cache.js';
import { uploadImage, deleteImage } from '../utils/cloudinary.js';
import { config } from '../config/index.js';

// ─── Get All Products (public) ──────────────────────────
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  // Build a cache key from the query string so that identical requests
  // hit the cache. JSON.stringify ensures objects like { page: "2", keyword: "phone" }
  // become a consistent string. Different queries = different cache keys.
  const cacheKey = `list:${JSON.stringify(req.query)}`;

  // Check Redis first — if this exact query was made recently, return it.
  const cached = await cacheGet<{ data: unknown; pagination: unknown }>(cacheKey);
  if (cached) {
    res.status(200).json({ success: true, ...cached });
    return;
  }

  const resPerPage = 8;

  const apiFeatures = new APIFeatures(Product.find(), req.query)
    .search()
    .filter()
    .sort()
    .pagination(resPerPage);

  const products = await apiFeatures.query;
  const pagination = await apiFeatures.getPagination();

  // Store the result in Redis for next time. TTL = 5 minutes (default).
  await cacheSet(cacheKey, { data: products, pagination });

  res.status(200).json({
    success: true,
    data: products,
    pagination,
  });
};

// ─── Get Single Product (public) ────────────────────────
export const getSingleProduct = async (req: Request, res: Response): Promise<void> => {
  // Cache key is just the product ID — one product, one key.
  const cacheKey = `item:${req.params.id}`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.status(200).json({ success: true, data: cached });
    return;
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('Product');
  }

  // Cache the product object. Next time someone views this product page,
  // it comes from Redis instead of MongoDB.
  await cacheSet(cacheKey, product);

  res.status(200).json({ success: true, data: product });
};

// ─── Create Product (admin) ─────────────────────────────
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  req.body.createdBy = req.user!.id;

  const product = await Product.create(req.body);

  // A new product exists — every cached listing page could be stale.
  // "list:*" matches all keys like "products:list:{...}" and deletes them.
  // We don't know which pages/filters would include this product, so nuke them all.
  await cacheDelPattern('list:*');

  res.status(201).json({ success: true, data: product });
};

// ─── Update Product (admin) ─────────────────────────────
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!product) {
    throw new NotFoundError('Product');
  }

  // The product changed — delete its individual cache entry AND all listing caches.
  // Both are stale: the single product page shows old data, and listing pages
  // might show the old name/price/image.
  await cacheDel(`item:${req.params.id}`);
  await cacheDelPattern('list:*');

  res.status(200).json({ success: true, data: product });
};

// ─── Delete Product (admin) ─────────────────────────────
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('Product');
  }

  await product.deleteOne();

  // Product is gone — remove its cache and all listing caches.
  await cacheDel(`item:${req.params.id}`);
  await cacheDelPattern('list:*');

  res.status(200).json({ success: true, message: 'Product deleted' });
};

// ─── Create / Update Review (authenticated) ─────────────
export const createProductReview = async (req: Request, res: Response): Promise<void> => {
  const { rating, comment, productId } = req.body;

  const product = await Product.findById(productId);

  if (!product) {
    throw new NotFoundError('Product');
  }

  const existingReviewIndex = product.reviews.findIndex(
    (rev) => rev.userId === req.user!.id
  );

  if (existingReviewIndex >= 0) {
    // Update existing review
    product.reviews[existingReviewIndex].rating = rating;
    product.reviews[existingReviewIndex].comment = comment;
  } else {
    // Add new review
    product.reviews.push({
      userId: req.user!.id,
      name: req.body.name || 'Anonymous',
      rating,
      comment,
    });
  }

  product.numOfReviews = product.reviews.length;

  product.rating =
    product.reviews.reduce((acc, rev) => acc + rev.rating, 0) /
    product.reviews.length;

  await product.save({ validateBeforeSave: false });

  // Review changed the product's rating — invalidate its cache and listings
  // (listings show star ratings, so they're stale too).
  await cacheDel(`item:${productId}`);
  await cacheDelPattern('list:*');

  res.status(200).json({ success: true, data: product });
};

// ─── Get Product Reviews (public) ───────────────────────
export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('Product');
  }

  res.status(200).json({ success: true, data: product.reviews });
};

// ─── Delete Review (admin) ──────────────────────────────
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.query.productId);

  if (!product) {
    throw new NotFoundError('Product');
  }

  product.reviews = product.reviews.filter(
    (rev) => (rev as any)._id.toString() !== req.query.reviewId
  );

  product.numOfReviews = product.reviews.length;
  product.rating =
    product.reviews.length === 0
      ? 0
      : product.reviews.reduce((acc, rev) => acc + rev.rating, 0) /
        product.reviews.length;

  await product.save({ validateBeforeSave: false });

  // Review deleted — rating changed, invalidate caches.
  await cacheDel(`item:${req.query.productId}`);
  await cacheDelPattern('list:*');

  res.status(200).json({ success: true });
};


// ─── Upload Product Image (admin) ────────────────────────
export const uploadProductImage = async (req: Request, res: Response): Promise<void> => {
  // req.file is set by multer middleware. If the client didn't send a file
  // (or it was rejected by the file filter), req.file is undefined.
  if (!req.file) {
    throw new ValidationError('Please upload an image file');
  }

  // Guard: if Cloudinary credentials aren't configured, fail early
  // with a clear message rather than a cryptic SDK error.
  if (!config.cloudinary.cloudName) {
    throw new ValidationError('Image upload is not configured');
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new NotFoundError('Product');
  }

  // Upload the raw bytes from memory to Cloudinary.
  // Returns the CDN URL and a publicId for future deletion.
  const { publicId, url } = await uploadImage(req.file.buffer);

  // Add the new image to the product's images array.
  product.images.push({ publicId, url });
  await product.save({ validateBeforeSave: false });

  // Invalidate caches — product detail shows the new image,
  // listing pages might show it as a thumbnail.
  await cacheDel(`item:${req.params.id}`);
  await cacheDelPattern('list:*');

  res.status(200).json({ success: true, data: product });
};

// ─── Delete Product Image (admin) ────────────────────────
export const deleteProductImage = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new NotFoundError('Product');
  }

  // publicId comes as a query param because it contains "/" characters
  // (e.g., "ecommerce/products/abc123") which would break URL paths.
  const publicId = req.query.publicId as string;
  if (!publicId) {
    throw new ValidationError('publicId query parameter is required');
  }

  // Find the image index in one pass — used for both validation and removal.
  const imageIndex = product.images.findIndex((img) => img.publicId === publicId);
  if (imageIndex === -1) {
    throw new NotFoundError('Image');
  }

  // Delete from Cloudinary first — if this fails, the image reference
  // stays in MongoDB so the admin can try again. If we deleted from
  // MongoDB first and Cloudinary failed, we'd have an orphaned image
  // on Cloudinary with no way to find and delete it.
  await deleteImage(publicId);

  // Remove from the array using the index we already found.
  // splice(index, 1) removes 1 element at that position, mutating in place.
  product.images.splice(imageIndex, 1);
  await product.save({ validateBeforeSave: false });

  await cacheDel(`item:${req.params.id}`);
  await cacheDelPattern('list:*');

  res.status(200).json({ success: true, data: product });
};