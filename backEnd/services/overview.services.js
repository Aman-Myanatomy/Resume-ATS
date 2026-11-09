import Application from '../models/application.models.js';
import { listCompanyInterviews } from './interview.services.js';

/**
 * What a recruiter should look at first: the best unreviewed candidates, the next interviews,
 * and this week's activity. Scoped to the employer's company.
 */
export async function getEmployerOverview(employer) {
  const company = employer.companyId;
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const weekAhead = Date.now() + 7 * 86400000;

  const [newThisWeek, awaitingReview, topToReview, interviews] = await Promise.all([
    Application.countDocuments({ company, createdAt: { $gte: weekAgo } }),
    Application.countDocuments({ company, stage: 'applied' }),
    Application.find({ company, stage: 'applied', scoreStatus: 'scored' })
      .sort({ score: -1, createdAt: -1 })
      .limit(5)
      .select('candidateName score knockoutFailed job createdAt')
      .populate('job', 'title status'),
    listCompanyInterviews(employer)
  ]);

  const upcoming = interviews.interviews.filter(i => new Date(i.scheduledAt).getTime() <= weekAhead);

  return {
    stats: { newThisWeek, awaitingReview, interviewsNext7Days: upcoming.length },
    topToReview: topToReview
      .filter(a => a.job)
      .map(a => ({
        id: a._id,
        candidateName: a.candidateName,
        score: a.score,
        knockoutFailed: a.knockoutFailed,
        appliedAt: a.createdAt,
        jobId: a.job._id,
        jobTitle: a.job.title
      })),
    upcomingInterviews: upcoming.slice(0, 4).map(i => ({
      id: i.id,
      scheduledAt: i.scheduledAt,
      durationMins: i.durationMins,
      mode: i.mode,
      candidateName: i.candidateName,
      jobTitle: i.jobTitle,
      jobId: i.jobId,
      applicationId: i.applicationId
    }))
  };
}
