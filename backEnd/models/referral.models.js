import mongoose from 'mongoose';

export const REFERRAL_KINDS = ['link', 'invite'];
export const REFERRAL_STATUSES = ['invited', 'applied'];
export const REFERRAL_RELATIONSHIPS = ['former_colleague', 'friend', 'classmate', 'family', 'professional_network', 'other'];

/**
 * Referral ORM Model Schema
 * An employee referring someone for one of their company's external jobs.
 *  - kind 'link':   the employee's personal referral link for a job (one per employee per job).
 *                   Every application through it is credited to them.
 *  - kind 'invite': the employee referred a specific person by email. Status moves invited -> applied
 *                   when that person applies (through the link in the email, or with the same email).
 */
const referralSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referrerName: { type: String, trim: true },
    referrerEmail: { type: String, trim: true, lowercase: true },
    kind: { type: String, enum: REFERRAL_KINDS, required: true },
    // Short random code used in ?ref= links.
    code: { type: String, required: true, unique: true },

    candidateName: { type: String, trim: true, maxlength: 120 },
    candidateEmail: { type: String, trim: true, lowercase: true, maxlength: 200 },
    relationship: { type: String, enum: [...REFERRAL_RELATIONSHIPS, ''], default: '' },
    note: { type: String, trim: true, maxlength: 1000 },

    status: { type: String, enum: REFERRAL_STATUSES, default: 'invited' },
    // Applications credited to this referral (an invite has at most one).
    applications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Application' }]
  },
  { timestamps: true }
);

referralSchema.index({ job: 1, referrer: 1, kind: 1 });
referralSchema.index({ job: 1, candidateEmail: 1 });

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
