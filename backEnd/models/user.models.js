import mongoose from 'mongoose';

export const USER_ROLES = ['candidate', 'employer'];
// Role inside an employer's company. owner: created the company (one per company).
// admin: manages team, billing and company profile. recruiter: jobs and pipeline only.
export const COMPANY_ROLES = ['owner', 'admin', 'recruiter'];

/**
 * User ORM Model Schema
 * A user is either a candidate (job seeker) or an employer (recruiter belonging to a company).
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
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'candidate',
      index: true
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      index: true
    },
    companyRole: {
      type: String,
      enum: COMPANY_ROLES
    },
    // false once a company admin removes this member; they can no longer sign in.
    active: {
      type: Boolean,
      default: true
    },
    // Candidate's saved resume, reused for fit checks and one-click apply.
    resume: {
      text: { type: String, select: false, maxlength: 30000 },
      fileName: { type: String, trim: true, maxlength: 160 },
      mimeType: { type: String, trim: true },
      updatedAt: Date
    },
    lastLoginAt: Date
  },
  {
    timestamps: true
  }
);

const User = mongoose.model('User', userSchema);
export default User;
