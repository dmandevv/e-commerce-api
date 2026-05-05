import mongoose, { Schema, Document } from 'mongoose';
import { PRODUCT_CATEGORIES } from '@ecommerce/shared';

export interface IReview {
  userId: string;
  name: string;
  rating: number;
  comment?: string;
}

export interface IVariantDocument {
  _id: mongoose.Types.ObjectId;
  sku: string;
  attributes: { size?: string; color?: string; [key: string]: string | undefined };
  stock: number;
  reservedStock: number;
  price?: number;
}

export interface IProductDocument extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  variants: [IVariantDocument, ...IVariantDocument[]];
  images: Array<{ publicId: string; url: string }>;
  reviews: IReview[];
  rating: number;
  numOfReviews: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<IVariantDocument>({
  sku: { type: String, required: true },
  attributes: { type: Map, of: String, default: {} },
  stock: { type: Number, required: true, min: 0, default: 0 },
  reservedStock: { type: Number, default: 0, min: 0 },
  price: { type: Number, min: 0 },
});


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
    variants: {
      type: [variantSchema],
      required: true,
      validate: [(v: any[]) => v.length > 0, 'Product must have at least one variant'],
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
