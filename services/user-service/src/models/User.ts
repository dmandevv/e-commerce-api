import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import validator from 'validator';

// ─── Interface ──────────────────────────────────────────
export interface IAddressDocument {
  _id: mongoose.Types.ObjectId;
  label: string; // e.g. "Home", "Work"
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface IUserDocument extends Document {
  name: string;
  email: string;
  password: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  role: 'customer' | 'admin';
  addresses: IAddressDocument[];
  failedLoginAttempts: number;
  lockedUntil?: Date;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ─────────────────────────────────────────────
const addressSchema = new Schema<IAddressDocument>(
  {
    label: {
      type: String,
      required: [true, 'Please enter a label that describes address'],
    },
    street: {
      type: String,
      required: [true, 'Please enter a street name'],
    },
    city: {
      type: String,
      required: [true, 'Please enter a city name'],
    },
    province: {
      type: String,
      required: [true, 'Please enter a province/state name'],
    },
    postalCode: {
      type: String,
      required: [true, 'Please enter a postal code'],
    },
    country: {
      type: String,
      required: [true, 'Please enter a country name'],
      default: 'Canada',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  }
);

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Please enter your name'],
      maxlength: [30, 'Your name cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please enter your email'],
      unique: true,
      validate: [validator.isEmail, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Please enter your password'],
      minlength: [6, 'Your password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ─── Middleware ──────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Methods ────────────────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUserDocument>('User', userSchema);
