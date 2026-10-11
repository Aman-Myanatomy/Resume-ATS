import mongoose from 'mongoose';

/**
 * User ORM Model Schema
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    lastLoginAt: Date
  },
  {
    timestamps: true
  }
);

const User = mongoose.model('User', userSchema);
export default User;

