import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshTokenDocument extends Document {
  token: string;          // the actual refresh token (random UUID/hash)
  userId: string;         // user this token belongs to
  family: string;         // groups rotated tokens (detect reuse)
  expiresAt: Date;        // hard expiry
  revoked: boolean;       // true once rotated/revoked
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired tokens via MongoDB TTL index
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema
);
