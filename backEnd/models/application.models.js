import mongoose from 'mongoose';

// Default stages. Companies can define their own (see services/pipeline.services.js), so `stage` is validated there.
export const PIPELINE_STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
// over_limit: the company used its plan's monthly AI scoring quota; scored after an upgrade (via rescore).
export const SCORE_STATUSES = ['pending', 'scoring', 'scored', 'failed', 'over_limit'];
// direct: applied from the job board. referral: came through an employee's referral.
// internal: the applicant is an employee of the hiring company (internal move).
export const APPLICATION_SOURCES = ['direct', 'referral', 'internal'];
export const INTERVIEW_MODES = ['video', 'phone', 'onsite'];
export const INTERVIEW_STATUSES = ['scheduled', 'completed', 'cancelled'];

const interviewSchema = new mongoose.Schema(
  {
    scheduledAt: { type: Date, required: true },
    durationMins: { type: Number, min: 15, max: 240, default: 45 },
    mode: { type: String, enum: INTERVIEW_MODES, default: 'video' },
    // Meeting link for video, phone number for phone, address for on-site.
    location: { type: String, trim: true, maxlength: 300 },
    interviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    interviewerNames: [String],
    note: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: INTERVIEW_STATUSES, default: 'scheduled' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: String
  },
  { timestamps: true }
);

/**
 * Application ORM Model Schema
 * One candidate applying to one job. Carries the AI fit report and the pipeline state.
 */
const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Snapshot at apply time so the employer view never needs to read the User collection.
    candidateName: { type: String, trim: true },
    candidateEmail: { type: String, trim: true },

    resumeText: { type: String, required: true, select: false, maxlength: 30000 },
    resumeHash: { type: String, index: true },
    resumeName: { type: String, trim: true, maxlength: 160 },
    resumeFile: {
      mimeType: { type: String, trim: true },
      size: { type: Number, min: 0 }
    },
    resumeAsset: {
      publicId: { type: String, trim: true },
      url: { type: String, trim: true },
      resourceType: { type: String, trim: true }
    },
    coverNote: { type: String, trim: true, maxlength: 2000 },
    answers: [{ _id: false, question: String, answer: { type: String, enum: ['yes', 'no'] } }],
    knockoutFailed: { type: Boolean, default: false },

    source: { type: String, enum: APPLICATION_SOURCES, default: 'direct' },
    referral: {
      referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral' },
      referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      referrerName: { type: String, trim: true },
      referrerEmail: { type: String, trim: true },
      relationship: { type: String, trim: true },
      note: { type: String, trim: true, maxlength: 1000 }
    },

    score: { type: Number, min: 0, max: 100, default: null },
    result: { type: mongoose.Schema.Types.Mixed },
    scoreStatus: { type: String, enum: SCORE_STATUSES, default: 'pending', index: true },
    scoreError: { type: String },
    scoredAt: Date,
    jobVersion: Number,

    stage: { type: String, trim: true, maxlength: 40, default: 'applied' },
    stageHistory: [{
      _id: false,
      stage: { type: String, trim: true, maxlength: 40 },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date, default: Date.now }
    }],
    notes: [{
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      authorName: String,
      text: { type: String, trim: true, maxlength: 2000 },
      createdAt: { type: Date, default: Date.now }
    }],
    interviews: { type: [interviewSchema], default: [] }
  },
  { timestamps: true }
);

applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });
applicationSchema.index({ job: 1, score: -1, createdAt: -1 });
applicationSchema.index({ candidate: 1, createdAt: -1 });
applicationSchema.index({ company: 1, 'interviews.scheduledAt': 1 });
applicationSchema.index({ company: 1, scoredAt: 1 });

const Application = mongoose.model('Application', applicationSchema);
export default Application;
