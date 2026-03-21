import mongoose, { Schema, Document } from 'mongoose';
import { PRODUCT_CATEGORIES } from '@ecommerce/shared';

export interface IReview {
  userId: string;
  name: string;
  rating: number;
  comment?: string;
}

export interface IProductDocument extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  images: Array<{ publicId: string; url: string }>;
  reviews: IReview[];
  rating: number;
  numOfReviews: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProductDocument>(
  {
    name: {
      type: String,
      required: [true, 'Please enter product name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please enter product description'],
    },
    price: {
      type: Number,
      required: [true, 'Please enter product price'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Please select category for product'],
      enum: {
        values: [...PRODUCT_CATEGORIES],
        message: 'Please select correct category',
      },
    },
    stock: {
      type: Number,
      required: [true, 'Please enter product stock'],
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    images: [
      {
        publicId: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    reviews: [
      {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        rating: { type: Number, required: true },
        comment: { type: String },
      },
    ],
    rating: { type: Number, default: 0 },
    numOfReviews: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProductDocument>('Product', productSchema);
