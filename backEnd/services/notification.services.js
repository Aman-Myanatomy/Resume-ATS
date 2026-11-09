import User from '../models/user.models.js';
import { appUrl, queueEmail, renderEmail } from './email.services.js';
import { pushNotification } from './inbox.services.js';

/**
 * Notification emails for hiring events. Each function is fire-and-forget:
 * it looks up what it needs, queues the email, and never throws into the caller.
 */

const TIMEZONE = () => process.env.APP_TIMEZONE || 'Asia/Kolkata';
const MODE_LABEL = { video: 'Video call', phone: 'Phone call', onsite: 'On-site' };

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE(), weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(new Date(date));
}

function safe(fn) {
  return (...args) => {
    Promise.resolve()
      .then(() => fn(...args))
      .catch(error => console.error('Notification failed:', error.message));
  };
}

// ---------- Applications ----------

export const notifyApplicationReceived = safe(async ({ application, job }) => {
  const { html, text } = renderEmail({
    heading: `Your application to ${job.companyName} was sent`,
    lines: [
      `Hi ${application.candidateName?.split(' ')[0] || 'there'},`,
      `We've sent your application for ${job.title} to ${job.companyName}. You'll get an email when they update your status.`
    ],
    cta: { label: 'Track your applications', url: appUrl('/app/applications') }
  });
  queueEmail({ to: application.candidateEmail, subject: `Application sent: ${job.title} at ${job.companyName}`, html, text });

  const poster = await User.findOne({ _id: job.postedBy, active: { $ne: false } }).select('email name');
  if (!poster) return;
  await pushNotification(poster._id, {
    type: 'new_applicant',
    title: `New applicant for ${job.title}`,
    body: `${application.candidateName} applied${application.knockoutFailed ? ' (screening flag)' : ''}.`,
    link: `/employer/jobs/${job._id}?a=${application._id}`
  });
  const recruiter = renderEmail({
    heading: `New applicant for ${job.title}`,
    lines: [`${application.candidateName} just applied. Their AI fit report will be ready in about a minute.`],
    details: [['Job', job.title], ['Screening flag', application.knockoutFailed ? 'Answered a required question differently' : '']],
    cta: { label: 'Review applicants', url: appUrl(`/employer/jobs/${job._id}?a=${application._id}`) },
    footer: 'You get this email because you posted this job on Resumely.'
  });
  queueEmail({ to: poster.email, subject: `New applicant: ${application.candidateName} for ${job.title}`, ...recruiter });
});

const STAGE_COPY = {
  screening: { subject: 'is reviewing your application', line: 'Good news: the hiring team has moved your application to screening.' },
  assessment: { subject: 'has an assessment step for you', line: 'Good news: you have moved to the assessment stage. The team will share the assessment details with you.' },
  other: { subject: 'moved your application forward', line: 'Good news: the hiring team has moved your application to the next stage.' },
  interview: { subject: 'wants to interview you', line: 'Great news: you have been shortlisted for an interview. The team will share a time with you.' },
  offer: { subject: 'has an offer for you', line: 'Congratulations! The team has moved you to the offer stage. Expect to hear from them with details.' },
  hired: { subject: 'welcome aboard', line: 'Congratulations on your new role! The team has marked you as hired.' },
  rejected: { subject: 'update on your application', line: 'Thank you for your interest. After careful review, the team has decided not to move forward with your application at this time. We encourage you to apply for other roles that match your skills.' }
};

const STAGE_BELL = {
  screening: 'Your application is being reviewed.',
  assessment: "You've moved to the assessment stage.",
  other: 'Your application moved to the next stage.',
  interview: "You've been shortlisted for an interview.",
  offer: "You've reached the offer stage.",
  hired: "Congratulations, you're hired!",
  rejected: 'There is an update on your application.'
};

/**
 * Tells the candidate their application moved. `kind` is what the (possibly custom) stage means;
 * `label` is the company's name for it, e.g. "Technical round".
 */
export const notifyStageChange = safe(async ({ application, job, stage, kind = stage, label }) => {
  const base = STAGE_COPY[kind];
  if (!base || !job) return;
  const custom = label && !['rejected', 'hired'].includes(kind) && label.toLowerCase() !== kind;
  const copy = custom
    ? { subject: base.subject, line: `Good news: the hiring team has moved your application to ${label}.` }
    : base;
  const { html, text } = renderEmail({
    heading: `${job.companyName}: ${job.title}`,
    lines: [`Hi ${application.candidateName?.split(' ')[0] || 'there'},`, copy.line],
    cta: kind === 'rejected'
      ? { label: 'Find more jobs', url: appUrl('/jobs') }
      : { label: 'See your application', url: appUrl('/app/applications') }
  });
  queueEmail({ to: application.candidateEmail, subject: `${job.companyName} ${copy.subject}`, html, text });
  await pushNotification(application.candidate, {
    type: 'stage_change',
    title: `${job.companyName}: ${job.title}`,
    body: custom ? `Your application moved to ${label}.` : STAGE_BELL[kind],
    link: '/app/applications'
  });
});

// ---------- Interviews ----------

function calendarLinks(interview, title, details) {
  const start = new Date(interview.scheduledAt);
  const end = new Date(start.getTime() + interview.durationMins * 60000);
  const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(start)}/${stamp(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(interview.location || '')}`;
  const icsEscape = v => String(v || '').replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Resumely//Interviews//EN', 'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${interview._id}@resumely`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    `LOCATION:${icsEscape(interview.location)}`,
    interview.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  return { google, ics };
}

export const notifyInterview = safe(async ({ application, job, interview, change = 'scheduled' }) => {
  const when = formatDateTime(interview.scheduledAt);
  const where = interview.location || (interview.mode === 'onsite' ? 'Office address to be shared' : 'Link to be shared');
  const title = `Interview: ${job.title} at ${job.companyName}`;
  const cancelled = change === 'cancelled';
  const { google, ics } = calendarLinks(interview, title, `${MODE_LABEL[interview.mode]} interview for ${job.title}. ${interview.note || ''}`);

  const details = [
    ['When', when],
    ['Duration', `${interview.durationMins} minutes`],
    ['Type', MODE_LABEL[interview.mode]],
    [interview.mode === 'video' ? 'Meeting link' : interview.mode === 'phone' ? 'Phone' : 'Address', where],
    ['Interviewers', interview.interviewerNames?.join(', ')],
    ['Note', interview.note]
  ];

  const candidateMail = renderEmail({
    heading: cancelled ? `Interview cancelled: ${job.title}` : `Your interview with ${job.companyName}`,
    lines: cancelled
      ? [`Hi ${application.candidateName?.split(' ')[0] || 'there'},`, `Your interview scheduled for ${when} has been cancelled. The team may reach out with a new time.`]
      : [`Hi ${application.candidateName?.split(' ')[0] || 'there'},`, `Your interview for ${job.title} is confirmed. A calendar invite is attached.`],
    details: cancelled ? [] : details,
    cta: cancelled ? { label: 'See your applications', url: appUrl('/app/applications') } : { label: 'Add to Google Calendar', url: google }
  });
  queueEmail({
    to: application.candidateEmail,
    subject: cancelled ? `Cancelled: interview with ${job.companyName}` : `Interview confirmed: ${job.title} at ${job.companyName}`,
    ...candidateMail,
    icalEvent: { method: cancelled ? 'CANCEL' : 'REQUEST', content: ics }
  });

  await pushNotification(application.candidate, {
    type: cancelled ? 'interview_cancelled' : 'interview_scheduled',
    title: cancelled ? `Interview cancelled: ${job.companyName}` : `Interview with ${job.companyName}`,
    body: `${job.title} · ${when}`,
    link: '/app/applications'
  });

  // The employer gets the calendar invite too (they schedule and run the interview themselves).
  const interviewers = await User.find({ _id: { $in: interview.interviewers || [] }, active: { $ne: false } }).select('email');
  if (!interviewers.length) return;
  const teamMail = renderEmail({
    heading: cancelled ? `Cancelled: interview with ${application.candidateName}` : `Interview with ${application.candidateName}`,
    lines: [cancelled ? `Your interview for ${job.title} was cancelled. The candidate has been told.` : `Your interview with ${application.candidateName} for ${job.title} is scheduled. The candidate has been sent the same invite.`],
    details: cancelled ? [['Was scheduled for', when]] : details,
    cta: { label: 'Open candidate', url: appUrl(`/employer/jobs/${job._id}?a=${application._id}`) },
    footer: 'Your copy of the interview invite from Resumely.'
  });
  queueEmail({
    to: interviewers.map(u => u.email),
    subject: cancelled ? `Cancelled: ${application.candidateName} · ${job.title}` : `Interview: ${application.candidateName} · ${job.title} · ${when}`,
    ...teamMail,
    icalEvent: { method: cancelled ? 'CANCEL' : 'REQUEST', content: ics }
  });
});
