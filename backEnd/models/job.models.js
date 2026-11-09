import mongoose from 'mongoose';

export const WORK_MODES = ['onsite', 'remote', 'hybrid'];
export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'internship'];
export const JOB_STATUSES = ['draft', 'open', 'closed'];
// external: listed on the public job board (outside candidates apply, employees can refer).
// internal: only the company's own employees (matched by work email domain) can see and apply.
export const JOB_VISIBILITIES = ['external', 'internal'];
export const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Data', 'Sales', 'Marketing', 'Customer Success',
  'Operations', 'Finance', 'Human Resources', 'Legal', 'Other'
];

const screeningQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 240 },
    // 'yes' / 'no' make the question a knockout; 'any' just records the answer.
    requiredAnswer: { type: String, enum: ['yes', 'no', 'any'], default: 'any' }
  },
  { _id: false }
);

/**
 * Job ORM Model Schema
 */
const jobSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    // Denormalised so the public board can list and search jobs without a join.
    companyName: { type: String, required: true, trim: true },
    companySlug: { type: String, required: true, trim: true },
    // Mirrors the company's logo URL (Cloudinary or local) so job lists can show logos without a join.
    companyLogoUrl: { type: String, trim: true },
    // Legacy: logo version from before logos had a stored URL. Kept so older jobs still resolve.
    companyLogoVersion: { type: Number, default: 0 },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Human-readable job ID, unique across the platform, e.g. NIM-1004. Assigned on create.
    jobCode: { type: String, trim: true, uppercase: true },

    // Where the role sits inside the company.
    department: { type: String, trim: true, maxlength: 60, default: '' },
    team: { type: String, trim: true, maxlength: 80, default: '' },
    project: { type: String, trim: true, maxlength: 80, default: '' },
    hiringManager: { type: String, trim: true, maxlength: 80, default: '' },
    openings: { type: Number, min: 1, max: 500, default: 1 },

    visibility: { type: String, enum: JOB_VISIBILITIES, default: 'external', index: true },
    // Employees can refer people for external jobs. Bonus is free text, e.g. "₹25,000 after 90 days".
    referralsEnabled: { type: Boolean, default: true },
    referralBonus: { type: String, trim: true, maxlength: 120, default: '' },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    workMode: { type: String, enum: WORK_MODES, default: 'onsite' },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'full_time' },
    experienceMin: { type: Number, min: 0, max: 50, default: 0 },
    experienceMax: { type: Number, min: 0, max: 50 },
    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    salaryCurrency: { type: String, default: 'INR', maxlength: 3 },
    skills: { type: [String], default: [] },
    description: { type: String, required: true, trim: true, maxlength: 12000 },
    screeningQuestions: { type: [screeningQuestionSchema], default: [] },

    status: { type: String, enum: JOB_STATUSES, default: 'open', index: true },
    publishedAt: Date,
    // Bumped whenever a field that affects AI scoring changes, so cached scores are invalidated.
    contentVersion: { type: Number, default: 1 },
    applicationCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

jobSchema.index({ status: 1, publishedAt: -1 });
jobSchema.index({ company: 1, createdAt: -1 });
jobSchema.index({ jobCode: 1 }, { unique: true, sparse: true });

const Job = mongoose.model('Job', jobSchema);
export default Job;
