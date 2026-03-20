import { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { APIFeatures } from '../utils/apiFeatures.js';
import { NotFoundError, ValidationError } from '@ecommerce/shared/errors';

// ─── Get All Products (public) ──────────────────────────
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  const resPerPage = 8;

  const apiFeatures = new APIFeatures(Product.find(), req.query)
    .search()
    .filter()
    .sort()
    .pagination(resPerPage);

  const products = await apiFeatures.query;
  const pagination = await apiFeatures.getPagination();

  res.status(200).json({
    success: true,
    data: products,
    pagination,
  });
};

// ─── Get Single Product (public) ────────────────────────
export const getSingleProduct = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('Product');
  }

  res.status(200).json({ success: true, data: product });
};

// ─── Create Product (admin) ─────────────────────────────
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  req.body.createdBy = req.user!.id;

  const product = await Product.create(req.body);

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

  res.status(200).json({ success: true, data: product });
};

// ─── Delete Product (admin) ─────────────────────────────
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('Product');
  }

  await product.deleteOne();

  res.status(200).json({ success: true, message: 'Product deleted' });
};

// ─── Create / Update Review (authenticated) ─────────────
export const createProductReview = async (req: Request, res: Response): Promise<void> => {
  const { rating, comment, productId } = req.body;

  if (!rating || !productId) {
    throw new ValidationError('Rating and productId are required');
  }

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
      rating: Number(rating),
      comment,
    });
  }

  product.numOfReviews = product.reviews.length;

  product.rating =
    product.reviews.reduce((acc, rev) => acc + rev.rating, 0) /
    product.reviews.length;

  await product.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, data: product });
};

// ─── Get Product Reviews (public) ───────────────────────
export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.query.productId);

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

  res.status(200).json({ success: true });
};
