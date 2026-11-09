import mongoose from 'mongoose';
import { PLAN_IDS } from '../config/plans.config.js';

/**
 * Company ORM Model Schema
 * The employer-side tenant. Every job and application belongs to exactly one company.
 */
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    website: { type: String, trim: true, maxlength: 200 },
    location: { type: String, trim: true, maxlength: 120 },
    size: { type: String, enum: ['1-10', '11-50', '51-200', '201-1000', '1000+', ''], default: '' },
    about: { type: String, trim: true, maxlength: 4000 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Work email domains of the company's employees (e.g. "nimbuslabs.com"). A signed-in job seeker
    // whose email uses one of these domains counts as an employee: they see internal jobs and can refer.
    emailDomains: { type: [String], default: [] },
    // Job IDs are `${jobPrefix}-${jobSeq}`, e.g. NIM-1001. jobSeq is incremented atomically.
    jobPrefix: { type: String, trim: true, uppercase: true, maxlength: 5 },
    jobSeq: { type: Number, default: 1000 },

    // Custom hiring pipeline, in order (Applied first; Hired and Rejected last). Empty = default stages.
    // `key` is stored on applications; `kind` tells the system what the stage means. See pipeline.services.js.
    pipelineStages: [{
      _id: false,
      key: { type: String, trim: true, maxlength: 40 },
      label: { type: String, trim: true, maxlength: 40 },
      kind: { type: String, enum: ['applied', 'screening', 'assessment', 'interview', 'offer', 'other', 'hired', 'rejected'] }
    }],

    // Small square logo (resized in the browser before upload).
    // With Cloudinary configured the image lives there (url + publicId); otherwise the bytes are
    // stored here and served from /api/companies/:slug/logo. `url` is what clients use either way.
    logo: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
      data: { type: Buffer, select: false },
      mimeType: { type: String, enum: ['image/png', 'image/jpeg', 'image/webp'] },
      version: { type: Number, default: 0 }
    },

    // Subscription. A paid plan whose period has ended behaves as Starter.
    plan: { type: String, enum: PLAN_IDS, default: 'starter' },
    planRenewsAt: Date,
    billingHistory: [{
      _id: false,
      plan: { type: String, enum: PLAN_IDS },
      amount: Number, // paise
      mode: { type: String, enum: ['razorpay', 'demo'] },
      orderId: String,
      paymentId: String,
      paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      paidAt: { type: Date, default: Date.now },
      periodEnd: Date
    }],
    // Razorpay orders created but not yet paid: orderId -> plan. Prevents paying for one plan and claiming another.
    pendingOrders: [{
      _id: false,
      orderId: String,
      plan: { type: String, enum: PLAN_IDS },
      amount: Number,
      createdAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

companySchema.index({ emailDomains: 1 });

const Company = mongoose.model('Company', companySchema);
export default Company;
