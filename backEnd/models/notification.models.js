import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['new_applicant', 'stage_change', 'interview_scheduled', 'interview_cancelled', 'invite_accepted'];

/**
 * Notification ORM Model Schema
 * In-app notifications shown under the bell. Deleted automatically after 90 days.
 */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 400 },
    link: { type: String, maxlength: 300 }, // in-app path, e.g. /employer/jobs/:id?a=:appId
    readAt: Date,
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 }
  },
  { versionKey: false }
);

notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
