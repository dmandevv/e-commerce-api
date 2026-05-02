import mongoose, { Schema, Document } from 'mongoose';

export type VerificationTokenType = 'email-verification' | 'password-reset';

export interface IVerificationToken extends Document {
  token: string;                       // SHA-256 hash — never the raw value
  userId: mongoose.Types.ObjectId;
  type: VerificationTokenType;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const verificationTokenSchema = new Schema<IVerificationToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,                    // fast lookup, prevents collisions
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,                     // for "invalidate all of user's prior tokens"
    },
    type: {
      type: String,
      enum: ['email-verification', 'password-reset'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// MongoDB TTL index — auto-deletes documents after expiresAt passes.
// `expireAfterSeconds: 0` means "use the date in this field directly."
// Mongo runs a sweeper every ~60 seconds, so cleanup isn't instant but is automatic.
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationToken = mongoose.model<IVerificationToken>(
  'VerificationToken',
  verificationTokenSchema
);
