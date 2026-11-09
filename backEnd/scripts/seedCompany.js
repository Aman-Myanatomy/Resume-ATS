/**
 * Adds realistic demo data to an EXISTING employer's company (yours), without touching what is already there:
 * jobs (external + internal), employees, applicants across every stage, interviews, notes and referrals.
 *
 *   npm run seed:company -- you@yourcompany.com
 *
 * Safe to re-run: it first removes only the data this script created before (its demo people,
 * their applications/referrals, and the demo job titles below that have no other applicants).
 * Your own jobs, applicants and settings stay as they are.
 *
 * Because the demo adds several open jobs, a company on Starter is moved to a 30-day demo Growth plan
 * (no payment). Switch back any time from Plan & billing.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';

import User from '../models/user.models.js';
import Company from '../models/company.models.js';
import Job from '../models/job.models.js';
import Application from '../models/application.models.js';
import Analysis from '../models/analysis.models.js';
import Referral from '../models/referral.models.js';
import Notification from '../models/notification.models.js';
import { hashText } from '../utils/http.utils.js';
import { nextJobCode } from '../services/job.services.js';
import { emailDomain } from '../services/workplace.services.js';

const PASSWORD = 'Demo@1234';
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const ago = ms => new Date(now - ms);

const ownerEmail = String(process.argv[2] || '').trim().toLowerCase();
if (!ownerEmail) {
  console.error('Usage: npm run seed:company -- owner@yourcompany.com');
  process.exit(1);
}
const domain = emailDomain(ownerEmail);

// ---------- Demo people ----------
// Employees use the company's own email domain so they are recognised as employees.
const EMPLOYEES = {
  riya: { name: 'Riya Kapoor', local: 'riya.demo',
    resume: 'Riya Kapoor - Senior Frontend Engineer (4 years at this company). Leads the 3D anatomy viewer built with React and Three.js, WebGL performance work, mentors 3 engineers. Skills: React, TypeScript, Three.js, WebGL, performance.' },
  aditya: { name: 'Aditya Singh', local: 'aditya.demo',
    resume: 'Aditya Singh - QA Engineer (3 years at this company, 5 total). Owns the Playwright regression suite for web and the Appium suite for Android, set up CI quality gates, runs release sign-off. Skills: Playwright, Appium, API testing, CI, test strategy, mentoring.' },
  neha: { name: 'Neha Joshi', local: 'neha.demo',
    resume: 'Neha Joshi - Medical Content Lead, BDS. Manages a team of 6 medical writers producing anatomy and physiology modules. Skills: medical writing, curriculum design, team leadership.' },
  sameer: { name: 'Sameer Khan', local: 'sameer.demo',
    resume: 'Sameer Khan - Institutional Sales Manager. Closed partnerships with 40+ medical and nursing colleges. Skills: B2B sales, college partnerships, negotiation, CRM.' }
};

const CANDIDATES = {
  ishaan: { name: 'Ishaan Malhotra', email: 'ishaan.m@candidate.test',
    resume: 'Ishaan Malhotra - Frontend Engineer, 3 years at Byju\'s and a healthtech startup. React, TypeScript, Three.js and React Three Fiber for interactive 3D lessons; cut first-load time 40%. Skills: React, TypeScript, Three.js, WebGL, Redux, accessibility.' },
  kriti: { name: 'Kriti Bansal', email: 'kriti.b@candidate.test',
    resume: 'Kriti Bansal - Frontend Developer, 2 years. React and Next.js marketing sites and dashboards, Tailwind CSS. Some canvas animation, no 3D. Skills: React, Next.js, JavaScript, CSS, Tailwind.' },
  manav: { name: 'Manav Sethi', email: 'manav.s@candidate.test',
    resume: 'Manav Sethi - Full-stack developer, 1 year. MERN projects and a hackathon-winning AR anatomy prototype in Unity. Skills: JavaScript, React, Node.js, Unity (basic).' },
  drAnjali: { name: 'Dr. Anjali Rao', email: 'anjali.r@candidate.test',
    resume: 'Dr. Anjali Rao - MBBS (KMC Manipal). 2 years writing NEET-PG anatomy and physiology content for an edtech company; reviewed 300+ MCQs. Skills: medical writing, anatomy, MCQ creation, referencing (Gray\'s, BD Chaurasia).' },
  drFaiz: { name: 'Dr. Faiz Ahmed', email: 'faiz.a@candidate.test',
    resume: 'Dr. Faiz Ahmed - BDS. 1 year as a dental clinic associate; writes a health blog with 20k monthly readers. Skills: medical writing, SEO basics, patient education.' },
  shruti: { name: 'Shruti Nair', email: 'shruti.n@candidate.test',
    resume: 'Shruti Nair - B.Sc Nursing, 1 year as staff nurse, now freelancing as a healthcare content reviewer. Skills: clinical knowledge, proofreading, patient education.' },
  rohan: { name: 'Rohan Kulkarni', email: 'rohan.k@candidate.test',
    resume: 'Rohan Kulkarni - Business Development Executive, 3 years selling LMS and test-prep subscriptions to colleges in Maharashtra and Karnataka. 125% of target FY24. Skills: institutional sales, college partnerships, demos, CRM (Zoho), negotiation.' },
  pallavi: { name: 'Pallavi Das', email: 'pallavi.d@candidate.test',
    resume: 'Pallavi Das - Inside sales associate, 1.5 years at an edtech company calling students and parents. Skills: inside sales, cold calling, Hindi, Bengali, English, CRM.' },
  arnav: { name: 'Arnav Gupta', email: 'arnav.g@candidate.test',
    resume: 'Arnav Gupta - Field sales, 4 years in pharma (medical representative) visiting hospitals and colleges in Delhi NCR. Skills: field sales, doctor relationships, territory planning.' },
  tara: { name: 'Tara Menon', email: 'tara.m@candidate.test',
    resume: 'Tara Menon - Product Designer, 3 years. Designed a medical learning app used by 200k students; ran 30+ usability interviews; built a Figma design system. Skills: Figma, user research, prototyping, design systems, mobile UX.' },
  yash: { name: 'Yash Agarwal', email: 'yash.a@candidate.test',
    resume: 'Yash Agarwal - Graphic designer moving into UI. Social media creatives, two app redesign concepts on Behance. Skills: Figma, Illustrator, visual design.' },
  megha: { name: 'Megha Pillai', email: 'megha.p@candidate.test',
    resume: 'Megha Pillai - Customer support associate, 2 years at a SaaS company. Email, chat and phone support in English, Hindi and Malayalam; Freshdesk; CSAT 4.8. Skills: customer support, CRM, communication.' },
  dev: { name: 'Dev Chauhan', email: 'dev.c@candidate.test',
    resume: 'Dev Chauhan - Support executive, 1 year at a telecom BPO. Phone support in Hindi and English. Skills: phone support, communication.' }
};

// ---------- Jobs ----------
const JOBS = {
  frontend: {
    title: 'Frontend Engineer (React + Three.js)', department: 'Engineering', team: 'Web Platform', project: '3D Anatomy Atlas',
    hiringManager: 'Riya Kapoor', openings: 2, visibility: 'external', referralsEnabled: true, referralBonus: '₹40,000 after 90 days',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 2, experienceMax: 5, salaryMin: 1200000, salaryMax: 2200000,
    skills: ['React', 'TypeScript', 'Three.js', 'WebGL', 'Performance'], status: 'open', postedDaysAgo: 10,
    screeningQuestions: [
      { question: 'Have you shipped a production feature using Three.js or WebGL?', requiredAnswer: 'any' },
      { question: 'Can you work from our Bengaluru office 3 days a week?', requiredAnswer: 'yes' }
    ],
    description: `## About the role
Build the interactive 3D anatomy viewer that medical students use every day. You will join the Web Platform team on the 3D Anatomy Atlas project.

## What you will do
- Build React and TypeScript features around our Three.js anatomy models
- Keep 3D scenes fast on mid-range laptops and Android phones
- Work with medical content and design teams on new learning modules

## What we're looking for
- 2-5 years of React with TypeScript
- Hands-on Three.js or WebGL experience
- Care for performance and accessibility`
  },
  content: {
    title: 'Medical Content Writer (MBBS/BDS)', department: 'Product', team: 'Medical Content', project: 'NEET-PG Question Bank',
    hiringManager: 'Neha Joshi', openings: 3, visibility: 'external', referralsEnabled: true, referralBonus: '₹15,000 after 60 days',
    location: 'Remote (India)', workMode: 'remote', employmentType: 'full_time', experienceMin: 0, experienceMax: 3, salaryMin: 600000, salaryMax: 1000000,
    skills: ['Medical writing', 'Anatomy', 'MCQ creation', 'Referencing'], status: 'open', postedDaysAgo: 7,
    screeningQuestions: [{ question: 'Do you hold an MBBS or BDS degree?', requiredAnswer: 'yes' }],
    description: `## About the role
Write and review anatomy and physiology content for our NEET-PG question bank and 3D lessons.

## What you will do
- Write high-yield notes and clinically oriented MCQs with explanations
- Review content for accuracy against standard references
- Work with designers to turn concepts into 3D lessons

## What we're looking for
- MBBS or BDS degree
- Clear, accurate writing; NEET-PG familiarity is a plus`
  },
  sales: {
    title: 'Business Development Executive (Colleges)', department: 'Sales', team: 'Institutional Sales', project: '',
    hiringManager: 'Sameer Khan', openings: 3, visibility: 'external', referralsEnabled: true, referralBonus: '₹20,000 after 60 days',
    location: 'Pune', workMode: 'onsite', employmentType: 'full_time', experienceMin: 1, experienceMax: 5, salaryMin: 500000, salaryMax: 900000,
    skills: ['Institutional sales', 'College partnerships', 'Demos', 'CRM', 'Negotiation'], status: 'open', postedDaysAgo: 5,
    screeningQuestions: [{ question: 'Are you comfortable travelling to colleges 3-4 days a week?', requiredAnswer: 'yes' }],
    description: `## About the role
Bring MyAnatomy to medical, dental and nursing colleges across Maharashtra and Karnataka.

## What you will do
- Run demos for deans, faculty and students
- Build and close a pipeline of college partnerships
- Track every deal in our CRM

## What we're looking for
- 1-5 years of B2B or institutional sales, ideally to colleges
- Comfortable with frequent travel`
  },
  designer: {
    title: 'Product Designer (Mobile)', department: 'Design', team: 'Product Design', project: '',
    hiringManager: '', openings: 1, visibility: 'external', referralsEnabled: true, referralBonus: '',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 2, experienceMax: 5, salaryMin: 1000000, salaryMax: 1800000,
    skills: ['Figma', 'User research', 'Prototyping', 'Design systems', 'Mobile UX'], status: 'open', postedDaysAgo: 3,
    description: `## About the role
Own the design of our Android and iOS learning apps.

## What you will do
- Run research with medical students and turn findings into prototypes
- Extend our design system across web and mobile

## What we're looking for
- 2-5 years of product design with a mobile portfolio
- Strong Figma and research skills`
  },
  qaLead: {
    title: 'QA Lead', department: 'Engineering', team: 'Quality', project: '',
    hiringManager: 'Head of Engineering', openings: 1, visibility: 'internal', referralsEnabled: false, referralBonus: '',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 4, experienceMax: 10,
    skills: ['Test strategy', 'Playwright', 'Appium', 'CI', 'Mentoring'], status: 'open', postedDaysAgo: 4,
    description: `## About the role
Internal opening: lead quality across web and mobile and grow a 3-person QA team. Open to current employees only.

## What you will do
- Own the test strategy and release sign-off for web and mobile
- Coach QA engineers and raise automation coverage

## What we're looking for
- 4+ years in QA including automation (Playwright, Appium)
- Experience leading releases`
  },
  pmAnalytics: {
    title: 'Associate Product Manager, Learning Analytics', department: 'Product', team: 'Analytics', project: 'Student Insights',
    hiringManager: 'Head of Product', openings: 1, visibility: 'internal', referralsEnabled: false, referralBonus: '',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 1, experienceMax: 4,
    skills: ['Product thinking', 'SQL', 'Analytics', 'Stakeholder management'], status: 'open', postedDaysAgo: 2,
    description: `## About the role
Internal transfer: define and ship the Student Insights dashboards colleges use to track learning progress.

## What you will do
- Work with colleges to define the metrics that matter
- Write specs and partner with engineering and design

## What we're looking for
- 1-4 years in any role at the company with strong analytical skills
- Comfort with SQL is a plus`
  },
  devops: {
    title: 'DevOps Engineer', department: 'Engineering', team: 'Infrastructure', project: '',
    hiringManager: '', openings: 1, visibility: 'external', referralsEnabled: true, referralBonus: '₹40,000 after 90 days',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 3, experienceMax: 6, salaryMin: 1600000, salaryMax: 2600000,
    skills: ['AWS', 'Kubernetes', 'Terraform', 'CI/CD', 'CDN'], status: 'draft', postedDaysAgo: 1,
    description: `## About the role
Draft: our first DevOps hire to own AWS, CDN delivery of large 3D assets, and CI/CD. Details to be finalised before publishing.`
  },
  support: {
    title: 'Customer Support Associate', department: 'Customer Success', team: 'Student Support', project: '',
    hiringManager: '', openings: 1, visibility: 'external', referralsEnabled: true, referralBonus: '₹5,000 after 30 days',
    location: 'Bengaluru', workMode: 'onsite', employmentType: 'full_time', experienceMin: 0, experienceMax: 3, salaryMin: 300000, salaryMax: 450000,
    skills: ['Customer support', 'CRM', 'Communication', 'Hindi'], status: 'closed', postedDaysAgo: 35,
    description: `## About the role
Help students and colleges over chat, email and phone. This position has been filled.`
  }
};

// ---------- Applications ----------
const APPLICATIONS = [
  { job: 'frontend', who: 'ishaan', appliedAgo: 6 * DAY, stages: ['screening', 'interview'], answers: ['yes', 'yes'],
    ref: { by: 'riya', kind: 'invite', relationship: 'former_colleague', note: 'Worked with Ishaan at Byju\'s. He built their 3D lessons player and knows R3F really well.' },
    fit: [90, ['React', 'TypeScript', 'Three.js', 'WebGL', 'Performance'], [], 'Three years of React and Three.js for interactive 3D lessons, with measured performance gains; direct match.'],
    interview: { inDays: 1, hourIST: 11, minute: 30, mode: 'video', location: 'https://meet.google.com/myanatomy-fe-1', note: 'Technical round: 3D scene performance and React architecture.' },
    notes: ['Strong referral from Riya. Fast-track.', 'Screening call done: available in 30 days, expects 20 LPA.'] },
  { job: 'frontend', who: 'kriti', appliedAgo: 4 * DAY, stages: ['screening'], answers: ['no', 'yes'],
    fit: [72, ['React', 'TypeScript', 'Performance'], ['Three.js', 'WebGL'], 'Solid React and Next.js experience; no 3D work yet, so would need ramp-up on Three.js.'],
    notes: ['Good React fundamentals. Give a small Three.js take-home?'] },
  { job: 'frontend', who: 'manav', appliedAgo: 1 * DAY, stages: [], answers: ['yes', 'yes'],
    fit: [55, ['React'], ['TypeScript', 'Three.js', 'Performance'], 'Early-career MERN developer with an interesting AR prototype; below the experience level for this role.'] },
  { job: 'frontend', who: 'yash', appliedAgo: 3 * DAY, stages: ['rejected'], answers: ['no', 'no'],
    fit: [28, [], ['React', 'TypeScript', 'Three.js', 'WebGL'], 'Visual designer profile with no engineering experience.'] },

  { job: 'content', who: 'drAnjali', appliedAgo: 5 * DAY, stages: ['screening', 'interview', 'offer'], answers: ['yes'],
    ref: { by: 'neha', kind: 'link' },
    fit: [92, ['Medical writing', 'Anatomy', 'MCQ creation', 'Referencing'], [], 'MBBS with two years of NEET-PG anatomy content and MCQ review; excellent match.'],
    interview: { inDays: -2, hourIST: 16, minute: 0, mode: 'video', location: 'https://meet.google.com/myanatomy-content', status: 'completed', note: 'Writing test review with Neha.' },
    notes: ['Writing test: 9/10, very accurate references.', 'Offer sent at 9.5 LPA.'] },
  { job: 'content', who: 'drFaiz', appliedAgo: 2 * DAY, stages: ['screening'], answers: ['yes'],
    fit: [74, ['Medical writing', 'Referencing'], ['MCQ creation', 'Anatomy'], 'BDS with strong public health writing; MCQ and exam-oriented content are new.'] },
  { job: 'content', who: 'shruti', appliedAgo: 20 * HOUR, stages: [], answers: ['no'],
    fit: [61, ['Medical writing'], ['MCQ creation', 'Anatomy'], 'Nursing background with relevant clinical knowledge; does not hold MBBS or BDS as required.'] },

  { job: 'sales', who: 'rohan', appliedAgo: 3 * DAY, stages: ['screening', 'interview'], answers: ['yes'],
    ref: { by: 'sameer', kind: 'invite', relationship: 'professional_network', note: 'Competitor rep in Pune, very well connected with nursing college deans.' },
    fit: [88, ['Institutional sales', 'College partnerships', 'Demos', 'CRM', 'Negotiation'], [], 'Three years selling edtech to colleges in our exact regions, over target.'],
    interview: { inDays: 2, hourIST: 12, minute: 0, mode: 'onsite', location: 'MyAnatomy office, Bengaluru', note: 'Role-play demo with Sameer.' } },
  { job: 'sales', who: 'arnav', appliedAgo: 2 * DAY, stages: [], answers: ['yes'],
    fit: [70, ['Demos', 'Negotiation'], ['College partnerships', 'CRM'], 'Pharma field sales with strong relationship skills; colleges would be a new segment.'] },
  { job: 'sales', who: 'pallavi', appliedAgo: 10 * HOUR, stages: [], answers: ['no'],
    ref: { by: 'sameer', kind: 'link' },
    fit: [57, ['CRM'], ['Institutional sales', 'College partnerships'], 'Inside sales to students and parents; travel and institutional deals are new.'] },

  { job: 'designer', who: 'tara', appliedAgo: 2 * DAY, stages: ['screening'],
    ref: { by: 'riya', kind: 'link' },
    fit: [89, ['Figma', 'User research', 'Prototyping', 'Design systems', 'Mobile UX'], [], 'Designed a medical learning app at scale with a strong research practice; ideal fit.'] },
  { job: 'designer', who: 'yash', appliedAgo: 1 * DAY, stages: [],
    fit: [48, ['Figma'], ['User research', 'Prototyping', 'Mobile UX'], 'Visual design skills; product and research experience is limited.'] },

  { job: 'qaLead', who: 'aditya', appliedAgo: 2 * DAY, stages: ['screening'], internal: true,
    fit: [85, ['Test strategy', 'Playwright', 'Appium', 'CI', 'Mentoring'], [], 'Owns web and Android automation and release sign-off today; strong internal candidate.'],
    notes: ['Internal candidate. Discuss backfill plan for his current role.'] },
  { job: 'pmAnalytics', who: 'sameer', appliedAgo: 1 * DAY, stages: [], internal: true,
    fit: [63, ['Stakeholder management', 'Product thinking'], ['SQL', 'Analytics'], 'Deep customer knowledge from college sales; analytics and SQL would need support.'] },

  { job: 'support', who: 'megha', appliedAgo: 30 * DAY, stages: ['screening', 'interview', 'offer', 'hired'],
    fit: [86, ['Customer support', 'CRM', 'Communication', 'Hindi'], [], 'Two years of multilingual SaaS support with excellent CSAT.'],
    notes: ['Joined last week. Great hire.'] },
  { job: 'support', who: 'dev', appliedAgo: 29 * DAY, stages: ['rejected'],
    fit: [58, ['Communication', 'Hindi'], ['CRM'], 'Phone support experience; no chat or CRM tools.'] }
];

const PENDING_INVITES = [
  { job: 'frontend', by: 'aditya', candidateName: 'Kunal Shah', candidateEmail: 'kunal.shah@example.com', relationship: 'classmate', note: 'College friend, React dev at Swiggy.', ago: 1 * DAY },
  { job: 'content', by: 'neha', candidateName: 'Dr. Sneha Kulkarni', candidateEmail: 'sneha.kulkarni@example.com', relationship: 'former_colleague', note: 'MBBS, wrote for Marrow before.', ago: 2 * DAY },
  { job: 'sales', by: 'riya', candidateName: 'Varun Iyer', candidateEmail: 'varun.iyer@example.com', relationship: 'friend', note: '', ago: 8 * HOUR }
];

const RELATIONSHIP_LABELS = {
  former_colleague: 'Former colleague', friend: 'Friend', classmate: 'Classmate', family: 'Family',
  professional_network: 'Professional network', other: 'Other'
};

function fitReport(score, matched, missing, summary) {
  const verdict = score >= 85 ? 'Excellent match' : score >= 70 ? 'Strong match' : score >= 50 ? 'Partial match' : 'Weak match';
  return {
    score, verdict, summary,
    strengths: matched.length ? [`Demonstrates ${matched.slice(0, 3).join(', ')}`, score >= 80 ? 'Quantified, relevant impact' : 'Relevant foundation for the role'] : ['Clear, well-structured resume'],
    improvements: missing.length ? [`Show evidence of ${missing.slice(0, 2).join(' and ')}`, 'Add measurable outcomes to each role'] : ['Add one or two quantified achievements'],
    keywords: { matched, missing },
    sections: [
      { name: 'Contact & Header', score: Math.min(100, score + 8), note: 'Contact details are complete and easy to parse.' },
      { name: 'Experience Evidence', score: Math.max(0, score - 4), note: score > 70 ? 'Quantified, relevant work.' : 'Experience is thin or not clearly relevant.' },
      { name: 'Skills & Keywords', score, note: `${matched.length} of the required skills are demonstrated.` },
      { name: 'ATS Formatting', score: Math.min(100, score + 5), note: 'Standard headings and single-column layout.' },
      { name: 'Job Alignment', score: Math.max(0, score - 6), note: missing.length ? `Missing: ${missing.join(', ')}.` : 'Strong alignment with the role.' }
    ]
  };
}

function istDate(inDays, hour, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + inDays);
  const total = hour * 60 + minute - 330;
  d.setUTCHours(Math.floor(total / 60), total % 60, 0, 0);
  return d;
}

const code = () => crypto.randomBytes(6).toString('base64url');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DATABASE || 'resumely' });

  const owner = await User.findOne({ email: ownerEmail, role: 'employer' });
  if (!owner?.company) throw new Error(`No employer account with a company found for ${ownerEmail}.`);
  const company = await Company.findById(owner.company);
  if (!company) throw new Error('That employer has no company.');
  console.log(`Company: ${company.name} (owner ${owner.name})`);

  const employeeEmail = key => `${EMPLOYEES[key].local}@${domain}`;
  const personEmails = [...Object.keys(EMPLOYEES).map(employeeEmail), ...Object.values(CANDIDATES).map(c => c.email)];
  const titles = Object.values(JOBS).map(j => j.title);

  // ---- Remove only what this script created earlier ----
  const oldPeople = (await User.find({ email: { $in: personEmails } }).select('_id role company')).map(u => u._id);
  const demoJobs = await Job.find({ company: company._id, title: { $in: titles } }).select('_id');
  const removableJobs = [];
  for (const job of demoJobs) {
    const foreign = await Application.exists({ job: job._id, candidate: { $nin: oldPeople } });
    if (!foreign) removableJobs.push(job._id);
  }
  await Application.deleteMany({ candidate: { $in: oldPeople } });
  await Referral.deleteMany({ $or: [{ referrer: { $in: oldPeople } }, { job: { $in: removableJobs } }] });
  await Analysis.deleteMany({ $or: [{ user: { $in: oldPeople } }, { job: { $in: removableJobs } }] });
  await Notification.deleteMany({ user: { $in: oldPeople } });
  await Job.deleteMany({ _id: { $in: removableJobs } });
  await User.deleteMany({ _id: { $in: oldPeople }, role: 'candidate' });

  // ---- Company settings: employee domain + enough plan room for the demo jobs ----
  const domainTaken = await Company.exists({ _id: { $ne: company._id }, emailDomains: domain });
  if (domainTaken) throw new Error(`${domain} is already used by another company, so demo employees can't be linked.`);
  const updates = { $addToSet: { emailDomains: domain } };
  const planActive = company.plan !== 'starter' && company.planRenewsAt && company.planRenewsAt > new Date();
  if (!planActive) {
    const renewsAt = new Date(now + 30 * DAY);
    updates.$set = { plan: 'growth', planRenewsAt: renewsAt };
    updates.$push = { billingHistory: { plan: 'growth', amount: 0, mode: 'demo', paidBy: owner._id, paidAt: new Date(), periodEnd: renewsAt } };
  }
  await Company.updateOne({ _id: company._id }, updates);
  const fresh = await Company.findById(company._id);

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const people = {};
  for (const [key, p] of Object.entries(EMPLOYEES)) {
    people[key] = await User.create({
      name: p.name, email: employeeEmail(key), passwordHash, role: 'candidate',
      resume: { text: p.resume, fileName: `${p.name.split(' ')[0]}_Resume.pdf`, mimeType: 'application/pdf', updatedAt: ago(10 * DAY) }
    });
  }
  for (const [key, p] of Object.entries(CANDIDATES)) {
    people[key] = await User.create({
      name: p.name, email: p.email, passwordHash, role: 'candidate',
      resume: { text: p.resume, fileName: `${p.name.replace(/^Dr\. /, '').split(' ')[0]}_Resume.pdf`, mimeType: 'application/pdf', updatedAt: ago(10 * DAY) }
    });
  }

  // ---- Jobs (oldest first, so job IDs follow posting order) ----
  const jobs = {};
  for (const [key, spec] of Object.entries(JOBS).sort((a, b) => b[1].postedDaysAgo - a[1].postedDaysAgo)) {
    const { postedDaysAgo, ...fields } = spec;
    const postedAt = ago(postedDaysAgo * DAY);
    jobs[key] = await Job.create({
      ...fields,
      screeningQuestions: fields.screeningQuestions || [],
      jobCode: await nextJobCode(fresh),
      company: company._id,
      companyName: fresh.name,
      companySlug: fresh.slug,
      companyLogoUrl: fresh.logo?.url || undefined,
      companyLogoVersion: fresh.logo?.version || 0,
      postedBy: owner._id,
      publishedAt: spec.status === 'draft' ? undefined : postedAt,
      createdAt: postedAt
    });
  }

  const links = new Map();
  async function referralLink(by, jobKey, createdAt) {
    const id = `${by}:${jobKey}`;
    if (!links.has(id)) {
      const emp = people[by];
      links.set(id, await Referral.create({
        company: company._id, job: jobs[jobKey]._id, referrer: emp._id, referrerName: emp.name, referrerEmail: emp.email,
        kind: 'link', code: code(), status: 'invited', createdAt
      }));
    }
    return links.get(id);
  }

  const counts = {};
  for (const spec of APPLICATIONS) {
    const job = jobs[spec.job];
    const person = people[spec.who];
    const appliedAt = ago(spec.appliedAgo);
    const [score, matched, missing, summary] = spec.fit;
    const questions = job.screeningQuestions || [];
    const answers = questions.map((q, i) => ({ question: q.question, answer: spec.answers?.[i] || 'yes' }));
    const knockoutFailed = questions.some((q, i) => q.requiredAnswer !== 'any' && answers[i].answer !== q.requiredAnswer);
    const stageHistory = [{ stage: 'applied', by: person._id, at: appliedAt }];
    spec.stages.forEach((stage, i) => stageHistory.push({ stage, by: owner._id, at: new Date(appliedAt.getTime() + ((i + 1) / (spec.stages.length + 1)) * spec.appliedAgo) }));

    let source = spec.internal ? 'internal' : 'direct';
    let referral;
    let referralDoc;
    if (spec.ref) {
      const emp = people[spec.ref.by];
      referralDoc = spec.ref.kind === 'invite'
        ? await Referral.create({
          company: company._id, job: job._id, referrer: emp._id, referrerName: emp.name, referrerEmail: emp.email,
          kind: 'invite', code: code(), candidateName: person.name, candidateEmail: person.email,
          relationship: spec.ref.relationship, note: spec.ref.note, status: 'applied', createdAt: new Date(appliedAt.getTime() - 6 * HOUR)
        })
        : await referralLink(spec.ref.by, spec.job, new Date(appliedAt.getTime() - DAY));
      source = 'referral';
      referral = {
        referralId: referralDoc._id, referrer: emp._id, referrerName: emp.name, referrerEmail: emp.email,
        relationship: spec.ref.relationship ? RELATIONSHIP_LABELS[spec.ref.relationship] : '', note: spec.ref.note || ''
      };
    }

    const interviews = spec.interview ? [{
      scheduledAt: istDate(spec.interview.inDays, spec.interview.hourIST, spec.interview.minute), durationMins: 45,
      mode: spec.interview.mode, location: spec.interview.location, interviewers: [owner._id], interviewerNames: [owner.name],
      note: spec.interview.note, status: spec.interview.status || 'scheduled', createdBy: owner._id, createdByName: owner.name
    }] : [];

    const application = await Application.create({
      job: job._id, company: company._id, candidate: person._id, candidateName: person.name, candidateEmail: person.email,
      resumeText: person.resume.text, resumeHash: hashText(person.resume.text), resumeName: person.resume.fileName,
      resumeFile: { mimeType: 'application/pdf', size: 84_000 },
      answers, knockoutFailed, source, referral,
      score, result: fitReport(score, matched, missing, summary), scoreStatus: 'scored',
      scoredAt: new Date(appliedAt.getTime() + 60_000), jobVersion: job.contentVersion,
      stage: spec.stages.at(-1) || 'applied', stageHistory,
      notes: (spec.notes || []).map((text, i) => ({ author: owner._id, authorName: owner.name, text, createdAt: new Date(appliedAt.getTime() + (i + 1) * 0.3 * spec.appliedAgo) })),
      interviews, createdAt: appliedAt
    });
    if (referralDoc) {
      referralDoc.status = 'applied';
      referralDoc.applications.push(application._id);
      await referralDoc.save();
    }
    counts[spec.job] = (counts[spec.job] || 0) + 1;
  }
  for (const [key, count] of Object.entries(counts)) await Job.updateOne({ _id: jobs[key]._id }, { applicationCount: count });

  for (const inv of PENDING_INVITES) {
    const emp = people[inv.by];
    await Referral.create({
      company: company._id, job: jobs[inv.job]._id, referrer: emp._id, referrerName: emp.name, referrerEmail: emp.email,
      kind: 'invite', code: code(), candidateName: inv.candidateName, candidateEmail: inv.candidateEmail,
      relationship: inv.relationship, note: inv.note, status: 'invited', createdAt: ago(inv.ago)
    });
  }

  console.log(`\nAdded ${Object.keys(jobs).length} jobs, ${APPLICATIONS.length} applicants, ${Object.keys(EMPLOYEES).length} employees, ${links.size + APPLICATIONS.filter(a => a.ref?.kind === 'invite').length + PENDING_INVITES.length} referrals.`);
  if (!planActive) console.log('Plan: moved to a 30-day demo Growth plan (no payment) so all demo jobs can be open.');
  console.log(`Employee email domain: ${domain}\n`);
  for (const job of Object.values(jobs)) {
    console.log(`  ${job.jobCode.padEnd(9)} ${job.title.padEnd(48)} ${job.visibility.padEnd(9)} ${job.status}`);
  }
  console.log(`\nDemo logins (password ${PASSWORD}):`);
  for (const key of Object.keys(EMPLOYEES)) console.log(`  Employee   ${employeeEmail(key)}`);
  console.log(`  Candidate  ${CANDIDATES.ishaan.email} (interview tomorrow, referred)`);
  await mongoose.disconnect();
}

seed().catch(async error => {
  console.error('Seeding failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
