/**
 * Seeds the job board with demo employers, employees, jobs (external and internal), referrals
 * and pre-scored applicants across every pipeline stage.
 * Safe to re-run: it only removes data belonging to the demo accounts and companies below.
 *
 *   npm run seed:jobs
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

const PASSWORD = 'Demo@1234';
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const ago = ms => new Date(now - ms);

// ---------- Companies (one hiring owner each) ----------

const COMPANIES = {
  nimbus: {
    owner: { name: 'Neha Kapoor', email: 'hiring@nimbuslabs.test' },
    plan: 'growth',
    data: {
      name: 'Nimbus Labs', slug: 'nimbus-labs', website: 'https://example.com', location: 'Bengaluru', size: '51-200',
      about: 'Nimbus Labs builds developer tooling for cloud cost visibility. We are a product-first team of 80 across Bengaluru and remote, backed by Series A investors.',
      emailDomains: ['nimbuslabs.test'], jobPrefix: 'NIM',
      // Custom hiring pipeline: an assessment step and two interview rounds.
      pipelineStages: [
        { key: 'applied', label: 'Applied', kind: 'applied' },
        { key: 'screening', label: 'Screening', kind: 'screening' },
        { key: 'assessment', label: 'Assessment', kind: 'assessment' },
        { key: 'interview', label: 'Technical interview', kind: 'interview' },
        { key: 'hr_round', label: 'HR round', kind: 'interview' },
        { key: 'offer', label: 'Offer', kind: 'offer' },
        { key: 'hired', label: 'Hired', kind: 'hired' },
        { key: 'rejected', label: 'Rejected', kind: 'rejected' }
      ]
    }
  },
  kirana: {
    owner: { name: 'Vikram Rao', email: 'talent@kiranapay.test' },
    plan: 'starter',
    data: {
      name: 'KiranaPay', slug: 'kiranapay', website: 'https://example.org', location: 'Pune', size: '11-50',
      about: 'KiranaPay helps neighbourhood stores accept UPI, manage credit and reorder stock from one app. 40,000 stores across Maharashtra use us every day.',
      emailDomains: ['kiranapay.test'], jobPrefix: 'KPY'
    }
  }
};

// Employees sign in as normal job seekers with their work email. The domain makes them employees.
const EMPLOYEES = {
  ananya: { name: 'Ananya Rao', email: 'ananya.rao@nimbuslabs.test', company: 'nimbus',
    resume: 'Ananya Rao - Senior Software Engineer, Platform team at Nimbus Labs (3 years). 8 years total. Led the billing-ingestion rewrite on Node.js and AWS (SQS, Lambda) processing 4 TB/day. Mentors 4 engineers, runs the platform on-call rotation and hiring loop. Previously Paytm (payments APIs). Skills: Node.js, AWS, MongoDB, system design, people leadership, hiring.' },
  karan: { name: 'Karan Malhotra', email: 'karan.malhotra@nimbuslabs.test', company: 'nimbus',
    resume: 'Karan Malhotra - Product Manager at Nimbus Labs (2 years). Owns the cost-anomaly product. Writes SQL daily against our warehouse, built Metabase dashboards for activation and churn. Previously business analyst at Swiggy (3 years). Skills: SQL, Metabase, Python (basic), A/B testing, stakeholder management.' },
  divya: { name: 'Divya Menon', email: 'divya.menon@nimbuslabs.test', company: 'nimbus',
    resume: 'Divya Menon - Design Lead at Nimbus Labs. 7 years in product design, built the Nimbus design system in Figma. Skills: Figma, design systems, user research.' },
  sneha: { name: 'Sneha Patil', email: 'sneha.patil@kiranapay.test', company: 'kirana',
    resume: 'Sneha Patil - Engineering Lead, Mobile at KiranaPay. Kotlin, Jetpack Compose, offline sync, UPI integrations.' }
};

// ---------- Jobs ----------

const JOBS = {
  backend: {
    company: 'nimbus', title: 'Backend Engineer (Node.js)', department: 'Engineering', team: 'Platform', project: 'Cost Ingestion v2',
    hiringManager: 'Ananya Rao', openings: 2, visibility: 'external', referralsEnabled: true, referralBonus: '₹50,000 after 90 days',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 2, experienceMax: 5, salaryMin: 1400000, salaryMax: 2400000,
    skills: ['Node.js', 'Express', 'MongoDB', 'Redis', 'AWS', 'REST APIs'], status: 'open', postedDaysAgo: 9,
    screeningQuestions: [
      { question: 'Do you have 2+ years of professional backend experience?', requiredAnswer: 'yes' },
      { question: 'Can you work from our Bengaluru office 3 days a week?', requiredAnswer: 'yes' }
    ],
    description: `## About the role
We are looking for a Backend Engineer to build the APIs and data pipelines behind our cloud cost dashboard. You will join the Platform team working on Cost Ingestion v2, our rewrite of the billing pipeline.

## What you will do
- Design and ship REST APIs in Node.js and Express used by thousands of engineering teams
- Model data in MongoDB and add caching with Redis for high-traffic endpoints
- Build ingestion jobs that process billing exports from AWS, GCP and Azure
- Own services end to end: testing, monitoring, and on-call for what you build

## What we're looking for
- 2-5 years building production backend services in Node.js
- Strong understanding of MongoDB schema design and indexing
- Experience with Redis, queues, and AWS services (S3, Lambda, SQS)
- Clear written communication; you will write design docs`
  },
  frontend: {
    company: 'nimbus', title: 'Frontend Engineer (React)', department: 'Engineering', team: 'Dashboard', project: '',
    hiringManager: 'Siddharth Jain', openings: 1, visibility: 'external', referralsEnabled: true, referralBonus: '₹40,000 after 90 days',
    location: 'Remote (India)', workMode: 'remote', employmentType: 'full_time', experienceMin: 1, experienceMax: 4, salaryMin: 1000000, salaryMax: 1800000,
    skills: ['React', 'TypeScript', 'Redux', 'CSS', 'Data visualisation'], status: 'open', postedDaysAgo: 6,
    description: `## About the role
Join our Dashboard team to build fast, accessible dashboards that make cloud spend easy to understand.

## What you will do
- Build React components with TypeScript and manage state with Redux Toolkit
- Create charts that explain complex billing data at a glance
- Work closely with design and backend engineers and ship to production every week

## What we're looking for
- 1-4 years of React experience and strong CSS fundamentals
- Care for accessibility and performance
- Nice to have: charting libraries such as D3 or Recharts`
  },
  design: {
    company: 'nimbus', title: 'Product Design Intern', department: 'Design', team: 'Design Systems', project: '',
    hiringManager: 'Divya Menon', openings: 2, visibility: 'external', referralsEnabled: true, referralBonus: '',
    location: 'Bengaluru', workMode: 'onsite', employmentType: 'internship', experienceMin: 0, experienceMax: 1, salaryMin: 300000, salaryMax: 420000,
    skills: ['Figma', 'User research', 'Prototyping', 'Design systems'], status: 'open', postedDaysAgo: 4,
    description: `## About the role
A 6-month paid internship on our design team.

## What you will do
- Run usability sessions with customers and turn findings into Figma prototypes
- Help maintain and extend our design system

## What we're looking for
- Final-year students or recent graduates with a portfolio of UX case studies
- Comfort with Figma and basic prototyping`
  },
  sales: {
    company: 'nimbus', title: 'Account Executive (Mid-Market)', department: 'Sales', team: 'India West', project: '',
    hiringManager: 'Rohan Bhatia', openings: 3, visibility: 'external', referralsEnabled: true, referralBonus: '₹30,000 after 60 days',
    location: 'Mumbai', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 2, experienceMax: 6, salaryMin: 1200000, salaryMax: 2000000,
    skills: ['B2B SaaS sales', 'Pipeline management', 'HubSpot', 'Negotiation', 'Cloud basics'], status: 'open', postedDaysAgo: 3,
    screeningQuestions: [{ question: 'Have you closed B2B SaaS deals above ₹10 lakh ARR?', requiredAnswer: 'any' }],
    description: `## About the role
Own the full sales cycle for mid-market companies in Mumbai and Pune who want control of their cloud spend.

## What you will do
- Run discovery, demos and commercial negotiation with engineering and finance leaders
- Build and manage your own pipeline in HubSpot
- Work with solutions engineers on proofs of concept

## What we're looking for
- 2-6 years of B2B SaaS sales, with a record of hitting quota
- Comfort talking to technical buyers about cloud infrastructure`
  },
  engManager: {
    company: 'nimbus', title: 'Engineering Manager, Platform', department: 'Engineering', team: 'Platform', project: '',
    hiringManager: 'Arvind Kumar (VP Engineering)', openings: 1, visibility: 'internal', referralsEnabled: false, referralBonus: '',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 6, experienceMax: 12, salaryMin: null, salaryMax: null,
    skills: ['People leadership', 'System design', 'Node.js', 'AWS', 'Hiring'], status: 'open', postedDaysAgo: 5,
    description: `## About the role
Internal opening: lead the 7-person Platform team as its first engineering manager. Open to current Nimbus employees only.

## What you will do
- Grow and coach the Platform engineers, run 1:1s and performance reviews
- Own delivery of Cost Ingestion v2 and the platform roadmap with product
- Lead platform hiring and the on-call rotation

## What we're looking for
- 6+ years in engineering, including technical leadership of a team
- Deep familiarity with our ingestion stack (Node.js, AWS)`
  },
  atlas: {
    company: 'nimbus', title: 'Analytics Engineer, Project Atlas', department: 'Data', team: 'Analytics', project: 'Project Atlas',
    hiringManager: 'Meghna Shah', openings: 1, visibility: 'internal', referralsEnabled: false, referralBonus: '',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 2, experienceMax: 6, salaryMin: null, salaryMax: null,
    skills: ['SQL', 'dbt', 'Python', 'Metabase', 'Data modelling'], status: 'open', postedDaysAgo: 2,
    description: `## About the role
Internal transfer: join Project Atlas, the 6-month effort to build our customer-facing analytics warehouse. Open to current Nimbus employees.

## What you will do
- Model billing and usage data in dbt on top of our warehouse
- Build the first Metabase dashboards customers will see
- Partner with product on metric definitions

## What we're looking for
- Strong SQL and comfort with Python
- Experience owning dashboards or data models used by others`
  },
  devops: {
    company: 'nimbus', title: 'DevOps Engineer', department: 'Engineering', team: 'Infrastructure', project: '',
    hiringManager: 'Ananya Rao', openings: 1, visibility: 'external', referralsEnabled: true, referralBonus: '₹50,000 after 90 days',
    location: 'Bengaluru', workMode: 'hybrid', employmentType: 'full_time', experienceMin: 3, experienceMax: 7, salaryMin: 1800000, salaryMax: 3000000,
    skills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Observability'], status: 'draft', postedDaysAgo: 1,
    description: `## About the role
Draft: we are planning our first dedicated DevOps hire to own Kubernetes, Terraform and our CI/CD pipelines on AWS. Details to be finalised with the Infrastructure team before publishing.`
  },
  qa: {
    company: 'nimbus', title: 'QA Engineer (Automation)', department: 'Engineering', team: 'Dashboard', project: '',
    hiringManager: 'Siddharth Jain', openings: 1, visibility: 'external', referralsEnabled: true, referralBonus: '₹25,000 after 90 days',
    location: 'Bengaluru', workMode: 'onsite', employmentType: 'full_time', experienceMin: 1, experienceMax: 4, salaryMin: 800000, salaryMax: 1400000,
    skills: ['Playwright', 'JavaScript', 'API testing', 'CI'], status: 'closed', postedDaysAgo: 40,
    description: `## About the role
Build our end-to-end test suite with Playwright and keep releases safe. This position has been filled.`
  },
  android: {
    company: 'kirana', title: 'Android Developer', department: 'Engineering', team: 'Mobile', project: 'Offline Ledger',
    hiringManager: 'Sneha Patil', openings: 1, visibility: 'external', referralsEnabled: true, referralBonus: '₹25,000 after 90 days',
    location: 'Pune', workMode: 'onsite', employmentType: 'full_time', experienceMin: 2, experienceMax: 6, salaryMin: 1200000, salaryMax: 2000000,
    skills: ['Kotlin', 'Jetpack Compose', 'Android', 'Offline-first', 'UPI'], status: 'open', postedDaysAgo: 7,
    description: `## About the role
KiranaPay's Android app is used by store owners on low-end devices with patchy internet. You will join the Mobile team on Offline Ledger, our offline-first credit book.

## What you will do
- Build features in Kotlin and Jetpack Compose
- Design local storage and sync that works without internet
- Integrate UPI payment flows and keep the app fast on 2GB RAM phones

## What we're looking for
- 2-6 years of Android experience
- Nice to have: payments or fintech experience`
  },
  support: {
    company: 'kirana', title: 'Customer Success Associate (Hindi & Marathi)', department: 'Customer Success', team: 'Store Onboarding', project: '',
    hiringManager: 'Vikram Rao', openings: 4, visibility: 'external', referralsEnabled: true, referralBonus: '₹5,000 after 30 days',
    location: 'Pune', workMode: 'onsite', employmentType: 'full_time', experienceMin: 0, experienceMax: 2, salaryMin: 350000, salaryMax: 500000,
    skills: ['Customer support', 'Hindi', 'Marathi', 'CRM', 'Communication'], status: 'open', postedDaysAgo: 5,
    screeningQuestions: [{ question: 'Are you fluent in both Hindi and Marathi?', requiredAnswer: 'yes' }],
    description: `## About the role
Help store owners get the most out of KiranaPay.

## What you will do
- Onboard new stores over phone and WhatsApp
- Solve payment and stock issues, and share feedback with the product team

## What we're looking for
- Fluency in Hindi and Marathi (English is a plus)
- Freshers with strong communication skills are welcome`
  },
  analyst: {
    company: 'kirana', title: 'Data Analyst', department: 'Data', team: 'Business Analytics', project: '',
    hiringManager: 'Vikram Rao', openings: 1, visibility: 'external', referralsEnabled: true, referralBonus: '',
    location: 'Pune', workMode: 'hybrid', employmentType: 'contract', experienceMin: 1, experienceMax: 3, salaryMin: 700000, salaryMax: 1100000,
    skills: ['SQL', 'Python', 'Metabase', 'Excel', 'Statistics'], status: 'closed', postedDaysAgo: 30,
    description: `## About the role
A 6-month contract to build our first analytics layer in SQL and Metabase. Applications for this role are closed.`
  }
};

// ---------- External candidates ----------

const CANDIDATES = {
  priya: { name: 'Priya Nair', email: 'priya@candidate.test',
    resume: 'Priya Nair - Backend Engineer, 4 years. Built Node.js and Express APIs serving 2M requests/day at a fintech startup (Paytm). Designed MongoDB schemas and cut p95 latency 45% by adding Redis caching. Built SQS-based ingestion on AWS Lambda. Skills: Node.js, Express, MongoDB, Redis, AWS, Docker, Jest.' },
  arjun: { name: 'Arjun Mehta', email: 'arjun@candidate.test',
    resume: 'Arjun Mehta - Software Engineer, 3 years. Developed REST APIs with Node.js and Express for an e-commerce platform. Used MongoDB and PostgreSQL. Containerised services with Docker and deployed on AWS EC2. Skills: JavaScript, Node.js, Express, MongoDB, Docker, AWS.' },
  meera: { name: 'Meera Iyer', email: 'meera@candidate.test',
    resume: 'Meera Iyer - Final year B.Tech CSE. Built a college events app with Node.js, Express and MongoDB as a capstone project. Internship: 3 months at a startup writing API tests. Skills: JavaScript, Node.js, MongoDB, Git.' },
  rohit: { name: 'Rohit Sharma', email: 'rohit@candidate.test',
    resume: 'Rohit Sharma - Frontend Developer, 2 years. Built React and TypeScript interfaces and dashboards with Redux. Strong CSS and accessibility. Worked with designers on Figma handoff. Skills: React, TypeScript, Redux, HTML, CSS, JavaScript, Figma.' },
  vivek: { name: 'Vivek Reddy', email: 'vivek@candidate.test',
    resume: 'Vivek Reddy - Senior Backend Engineer, 5 years at Razorpay and Freshworks. Node.js microservices on AWS (ECS, SQS, Lambda), MongoDB sharding, Redis rate limiting. Led migration of a payouts service handling ₹300 Cr/month. Skills: Node.js, Express, MongoDB, Redis, AWS, Kafka.' },
  harsh: { name: 'Harsh Gupta', email: 'harsh@candidate.test',
    resume: 'Harsh Gupta - Backend Developer, 2 years. Node.js and NestJS APIs with PostgreSQL; some MongoDB. Wrote Playwright and Jest tests and set up GitHub Actions CI. Skills: Node.js, Express, PostgreSQL, MongoDB, Playwright, CI.' },
  tanvi: { name: 'Tanvi Joshi', email: 'tanvi@candidate.test',
    resume: 'Tanvi Joshi - Frontend Engineer, 3 years at Zerodha. Built trading dashboards in React, TypeScript and Redux Toolkit with D3 and Recharts. Improved Lighthouse performance from 62 to 94. Skills: React, TypeScript, Redux, D3, Recharts, CSS, accessibility.' },
  sana: { name: 'Sana Khan', email: 'sana@candidate.test',
    resume: 'Sana Khan - QA Automation Engineer, 3 years. Playwright and Cypress suites, API testing with Postman, CI on GitHub Actions. Some React for test tooling. Skills: Playwright, JavaScript, API testing, CI, React (basic).' },
  aisha: { name: 'Aisha Thomas', email: 'aisha@candidate.test',
    resume: 'Aisha Thomas - B.Des final year, NID. Portfolio of 4 UX case studies including a fintech onboarding redesign tested with 12 users. Built a small design system in Figma for a college startup. Skills: Figma, user research, prototyping, design systems.' },
  pooja: { name: 'Pooja Sharma', email: 'pooja@candidate.test',
    resume: 'Pooja Sharma - Customer support executive, 1.5 years at an edtech company. Handled 60+ calls/day in Hindi, Marathi and English, Freshdesk CRM, CSAT 4.7/5. Also designed course thumbnails in Figma. Skills: Customer support, Hindi, Marathi, CRM, communication.' },
  nikhil: { name: 'Nikhil Verma', email: 'nikhil@candidate.test',
    resume: 'Nikhil Verma - Account Executive, 4 years in B2B SaaS (Freshworks, Chargebee). 118% of quota in FY24, closed 14 mid-market deals averaging ₹18 lakh ARR. HubSpot and Salesforce. Skills: B2B SaaS sales, pipeline management, negotiation, HubSpot.' },
  rahulD: { name: 'Rahul Desai', email: 'rahul.desai@candidate.test',
    resume: 'Rahul Desai - Inside Sales, 2 years at an HR-tech startup. Booked demos and closed SMB deals up to ₹4 lakh ARR. Salesforce user. Skills: Inside sales, cold outreach, Salesforce, negotiation.' },
  omkar: { name: 'Omkar Patil', email: 'omkar@candidate.test',
    resume: 'Omkar Patil - Android Developer, 4 years at PhonePe and a logistics startup. Kotlin and Jetpack Compose, Room with offline sync, UPI intent flows. Reduced APK size 35%. Skills: Kotlin, Jetpack Compose, Android, offline-first, UPI.' },
  kavya: { name: 'Kavya Deshmukh', email: 'kavya@candidate.test',
    resume: 'Kavya Deshmukh - Fresher, B.Com from Pune University. Volunteered on a helpline answering calls in Marathi and Hindi. Comfortable with Excel and WhatsApp Business. Skills: Communication, Hindi, Marathi, Excel.' }
};

// ---------- Applications ----------
// who: candidate or employee key. ref: { by: employee key, kind: 'invite'|'link', relationship, note }.
// stage path is recorded in stageHistory. interview: { inDays, hourIST, minute, mode, status }.

const APPLICATIONS = [
  // Backend Engineer (Node.js): the main demo pipeline
  { job: 'backend', who: 'priya', appliedAgo: 6 * DAY, stages: ['screening', 'interview'], answers: ['yes', 'yes'],
    ref: { by: 'ananya', kind: 'invite', relationship: 'former_colleague', note: 'Worked with Priya at Paytm for 2 years. She owned our payments API latency work and is excellent at debugging production issues.' },
    fit: [91, ['Node.js', 'Express', 'MongoDB', 'Redis', 'AWS', 'REST APIs'], [], 'Four years of production Node.js with quantified impact on latency and scale, plus direct MongoDB, Redis and AWS experience.'],
    interview: { inDays: 1, hourIST: 11, minute: 0, mode: 'video', location: 'https://meet.google.com/abc-defg-hij', note: 'Technical round: system design and a Redis caching discussion.' },
    notes: ['Strong referral from Ananya. Prioritise.', 'Phone screen done: clear communicator, wants hybrid. Moving to technical round.'] },
  { job: 'backend', who: 'vivek', appliedAgo: 8 * DAY, stages: ['screening', 'assessment', 'interview', 'hr_round', 'offer'], answers: ['yes', 'yes'],
    ref: { by: 'karan', kind: 'link' },
    fit: [87, ['Node.js', 'Express', 'MongoDB', 'Redis', 'AWS'], ['REST APIs design docs'], 'Five years of Node.js microservices on AWS with Redis and MongoDB at scale; very strong match for the senior end of the range.'],
    interview: { inDays: -3, hourIST: 15, minute: 0, mode: 'onsite', location: 'Nimbus Labs, Indiranagar, Bengaluru', status: 'completed', note: 'Final round with Ananya and Siddharth.' },
    notes: ['Final round feedback: strong hire. Offer at 24 LPA approved.', 'Offer letter sent on email, waiting for acceptance.'] },
  { job: 'backend', who: 'arjun', appliedAgo: 4 * DAY, stages: ['screening', 'assessment'], answers: ['yes', 'yes'],
    fit: [82, ['Node.js', 'Express', 'MongoDB', 'AWS', 'REST APIs'], ['Redis'], 'Solid Node.js API experience and MongoDB use; Redis and data pipeline work are not shown.'],
    notes: ['Good fundamentals. Ask about caching and queues in the screen.', 'Sent the take-home API assignment, due Friday.'] },
  { job: 'backend', who: 'harsh', appliedAgo: 5 * HOUR, stages: [], answers: ['yes', 'yes'],
    fit: [74, ['Node.js', 'Express', 'MongoDB'], ['Redis', 'AWS'], 'Two years of Node.js APIs with good testing habits; cloud and caching experience is limited.'] },
  { job: 'backend', who: 'meera', appliedAgo: 2 * DAY, stages: [], answers: ['no', 'yes'],
    fit: [58, ['Node.js', 'Express', 'MongoDB'], ['Redis', 'AWS', '2+ years experience'], 'Good fundamentals from projects and an internship, but no professional backend experience at the level required.'] },
  { job: 'backend', who: 'rohit', appliedAgo: 7 * DAY, stages: ['rejected'], answers: ['no', 'no'],
    fit: [34, [], ['Node.js', 'MongoDB', 'Redis', 'AWS', 'REST APIs'], 'Frontend profile with no backend, database or cloud experience shown.'],
    notes: ['Frontend profile. Suggested he apply to the React role instead.'] },

  // Frontend Engineer (React)
  { job: 'frontend', who: 'tanvi', appliedAgo: 5 * DAY, stages: ['screening', 'interview'],
    ref: { by: 'divya', kind: 'invite', relationship: 'professional_network', note: 'Met Tanvi at a React Bangalore meetup. Her Zerodha dashboard work is exactly what we need.' },
    fit: [88, ['React', 'TypeScript', 'Redux', 'CSS', 'Data visualisation'], [], 'Three years building React and TypeScript dashboards with D3 and Recharts; strong performance and accessibility focus.'],
    interview: { inDays: 2, hourIST: 15, minute: 0, mode: 'video', location: 'https://meet.google.com/xyz-react-int', note: 'Pairing round: build a small chart component.' } },
  { job: 'frontend', who: 'rohit', appliedAgo: 3 * DAY, stages: ['screening'],
    fit: [79, ['React', 'TypeScript', 'Redux', 'CSS'], ['Data visualisation'], 'Two years of React and TypeScript with strong CSS; no charting work shown yet.'] },
  { job: 'frontend', who: 'sana', appliedAgo: 1 * DAY, stages: [],
    fit: [52, ['CSS'], ['TypeScript', 'Redux', 'Data visualisation'], 'QA automation background with basic React; not yet at the level needed for a product frontend role.'] },

  // Product Design Intern
  { job: 'design', who: 'aisha', appliedAgo: 3 * DAY, stages: ['screening', 'assessment'],
    ref: { by: 'divya', kind: 'link' },
    fit: [84, ['Figma', 'User research', 'Prototyping', 'Design systems'], [], 'Strong portfolio with tested case studies and hands-on design system work.'] },
  { job: 'design', who: 'pooja', appliedAgo: 1 * DAY, stages: [],
    fit: [41, ['Figma'], ['User research', 'Prototyping', 'Design systems'], 'Some visual design in Figma but no UX research or case studies.'] },

  // Account Executive (Mid-Market)
  { job: 'sales', who: 'nikhil', appliedAgo: 2 * DAY, stages: ['screening', 'interview', 'hr_round'], answers: ['yes'],
    fit: [86, ['B2B SaaS sales', 'Pipeline management', 'HubSpot', 'Negotiation'], ['Cloud basics'], 'Four years of mid-market SaaS sales with a clear quota record and deal sizes above our target.'],
    interview: { inDays: 3, hourIST: 12, minute: 0, mode: 'phone', location: '+91 98450 00000', note: 'Hiring manager call with Rohan.' } },
  { job: 'sales', who: 'rahulD', appliedAgo: 20 * HOUR, stages: [], answers: ['no'],
    ref: { by: 'karan', kind: 'link' },
    fit: [66, ['Negotiation'], ['HubSpot', 'Pipeline management', 'Cloud basics'], 'Relevant SMB inside-sales experience; deal sizes and cycle are smaller than this role needs.'] },

  // Internal: Engineering Manager, Platform
  { job: 'engManager', who: 'ananya', appliedAgo: 2 * DAY, stages: ['screening'], internal: true,
    fit: [86, ['People leadership', 'System design', 'Node.js', 'AWS', 'Hiring'], [], 'Eight years of engineering including leading the Platform ingestion rewrite and mentoring; strong internal candidate.'],
    notes: ['Internal candidate. Talk to Arvind about calibration before the panel.'] },

  // Internal: Analytics Engineer, Project Atlas
  { job: 'atlas', who: 'karan', appliedAgo: 1 * DAY, stages: [], internal: true,
    fit: [68, ['SQL', 'Metabase', 'Python'], ['dbt', 'Data modelling'], 'Daily SQL and Metabase dashboards from product work; dbt and formal data modelling are new.'] },

  // Closed: QA Engineer (Automation), position filled
  { job: 'qa', who: 'sana', appliedAgo: 35 * DAY, stages: ['screening', 'assessment', 'interview', 'hr_round', 'offer', 'hired'],
    fit: [83, ['Playwright', 'JavaScript', 'API testing', 'CI'], [], 'Three years of Playwright and API test automation with CI; direct match.'],
    notes: ['Joined on the 1st. Great hire.'] },
  { job: 'qa', who: 'harsh', appliedAgo: 33 * DAY, stages: ['rejected'],
    fit: [61, ['Playwright', 'CI'], ['API testing'], 'Developer with some Playwright testing; automation is not their main focus.'] },

  // KiranaPay: Android Developer
  { job: 'android', who: 'omkar', appliedAgo: 4 * DAY, stages: ['screening', 'interview'],
    ref: { by: 'sneha', kind: 'invite', relationship: 'former_colleague', note: 'We built UPI flows together at PhonePe. Very strong on offline sync.' },
    fit: [89, ['Kotlin', 'Jetpack Compose', 'Android', 'Offline-first', 'UPI'], [], 'Four years of Kotlin and Compose with offline sync and UPI flows at PhonePe; excellent match.'],
    interview: { inDays: 1, hourIST: 16, minute: 30, mode: 'onsite', location: 'KiranaPay office, Baner, Pune', note: 'Tech round with Sneha.' } },
  { job: 'android', who: 'arjun', appliedAgo: 2 * DAY, stages: [],
    fit: [38, [], ['Kotlin', 'Jetpack Compose', 'Android'], 'Backend Node.js profile with no Android experience.'] },

  // KiranaPay: Customer Success Associate
  { job: 'support', who: 'pooja', appliedAgo: 3 * DAY, stages: ['screening'], answers: ['yes'],
    fit: [81, ['Customer support', 'Hindi', 'Marathi', 'CRM', 'Communication'], [], 'Eighteen months of high-volume support in Hindi and Marathi with strong CSAT.'] },
  { job: 'support', who: 'kavya', appliedAgo: 1 * DAY, stages: [], answers: ['yes'],
    ref: { by: 'sneha', kind: 'invite', relationship: 'family', note: 'My cousin. Fresher but very good with people and fluent in Marathi and Hindi.' },
    fit: [64, ['Hindi', 'Marathi', 'Communication'], ['CRM', 'Customer support'], 'Fresher with relevant language skills and helpline volunteering; no formal support experience.'] }
];

// Referral invites the candidate hasn't acted on yet.
const PENDING_INVITES = [
  { job: 'frontend', by: 'ananya', candidateName: 'Rakesh Iyer', candidateEmail: 'rakesh.iyer@example.com', relationship: 'classmate', note: 'IIT-M batchmate, 3 years of React at Flipkart.', ago: 2 * DAY },
  { job: 'backend', by: 'divya', candidateName: 'Farhan Ali', candidateEmail: 'farhan.ali@example.com', relationship: 'friend', note: 'Backend dev at Swiggy, looking for a change.', ago: 1 * DAY },
  { job: 'sales', by: 'karan', candidateName: 'Ishita Bose', candidateEmail: 'ishita.bose@example.com', relationship: 'former_colleague', note: 'Top performer from my Swiggy days.', ago: 10 * HOUR },
  { job: 'android', by: 'sneha', candidateName: 'Ganesh More', candidateEmail: 'ganesh.more@example.com', relationship: 'professional_network', note: '', ago: 6 * HOUR }
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
    improvements: missing.length ? [`Show evidence of ${missing.slice(0, 2).join(' and ')}`, 'Add measurable outcomes to each role'] : ['Mention ownership of monitoring or on-call'],
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

/** A Date for N days from today at the given IST time (IST = UTC+5:30). */
function istDate(inDays, hour, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + inDays);
  const totalMinutes = hour * 60 + minute - 330;
  d.setUTCHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return d;
}

const code = () => crypto.randomBytes(6).toString('base64url');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DATABASE || 'resumely' });
  console.log(`Connected to MongoDB (${process.env.MONGO_DATABASE || 'resumely'})`);

  const ownerEmails = [...Object.values(COMPANIES).map(c => c.owner.email), 'rahul@nimbuslabs.test'];
  const personEmails = [...Object.values(EMPLOYEES), ...Object.values(CANDIDATES)].map(p => p.email);
  const slugs = Object.values(COMPANIES).map(c => c.data.slug);

  // ---- Clean up previous demo data only ----
  const oldUsers = (await User.find({ email: { $in: [...ownerEmails, ...personEmails] } }).select('_id')).map(u => u._id);
  const companyIds = (await Company.find({ slug: { $in: slugs } }).select('_id')).map(c => c._id);
  const oldJobIds = await Job.find({ company: { $in: companyIds } }).distinct('_id');
  await Application.deleteMany({ $or: [{ company: { $in: companyIds } }, { candidate: { $in: oldUsers } }] });
  await Analysis.deleteMany({ $or: [{ user: { $in: oldUsers } }, { job: { $in: oldJobIds } }] });
  await Referral.deleteMany({ $or: [{ company: { $in: companyIds } }, { referrer: { $in: oldUsers } }] });
  await Notification.deleteMany({ user: { $in: oldUsers } });
  await Job.deleteMany({ company: { $in: companyIds } });
  await Company.deleteMany({ _id: { $in: companyIds } });
  await User.deleteMany({ $or: [{ _id: { $in: oldUsers } }, { company: { $in: companyIds } }] });

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const renewsAt = new Date(now + 30 * DAY);

  // ---- Companies and owners ----
  const companies = {};
  for (const [key, entry] of Object.entries(COMPANIES)) {
    const owner = await User.create({ name: entry.owner.name, email: entry.owner.email, passwordHash, role: 'employer', companyRole: 'owner' });
    const billing = entry.plan === 'growth'
      ? { plan: 'growth', planRenewsAt: renewsAt, billingHistory: [{ plan: 'growth', amount: 499900, mode: 'demo', paidBy: owner._id, paidAt: ago(DAY * 0), periodEnd: renewsAt }] }
      : { plan: 'starter' };
    const company = await Company.create({ ...entry.data, owner: owner._id, jobSeq: 1000, ...billing });
    owner.company = company._id;
    await owner.save();
    companies[key] = { company, owner };
  }

  // ---- People ----
  const people = {};
  for (const [key, p] of [...Object.entries(EMPLOYEES), ...Object.entries(CANDIDATES)]) {
    people[key] = await User.create({
      name: p.name, email: p.email, passwordHash, role: 'candidate',
      resume: { text: p.resume, fileName: `${p.name.split(' ')[0]}_Resume.pdf`, mimeType: 'application/pdf', updatedAt: ago(10 * DAY) }
    });
  }

  // ---- Jobs (job IDs in posting order per company) ----
  const jobs = {};
  const ordered = Object.entries(JOBS).sort((a, b) => b[1].postedDaysAgo - a[1].postedDaysAgo);
  for (const [key, spec] of ordered) {
    const { company, owner } = companies[spec.company];
    const { jobSeq } = await Company.findByIdAndUpdate(company._id, { $inc: { jobSeq: 1 } }, { new: true });
    const { company: _c, postedDaysAgo, ...fields } = spec;
    const postedAt = ago(postedDaysAgo * DAY);
    jobs[key] = await Job.create({
      ...fields,
      salaryMin: fields.salaryMin ?? undefined,
      salaryMax: fields.salaryMax ?? undefined,
      screeningQuestions: fields.screeningQuestions || [],
      jobCode: `${company.jobPrefix}-${jobSeq}`,
      company: company._id,
      companyName: company.name,
      companySlug: company.slug,
      postedBy: owner._id,
      publishedAt: spec.status === 'draft' ? undefined : postedAt,
      createdAt: postedAt
    });
  }

  // ---- Referral links (one per employee per job they shared) ----
  const links = new Map();
  async function referralLink(employeeKey, jobKey, createdAt) {
    const id = `${employeeKey}:${jobKey}`;
    if (!links.has(id)) {
      const emp = people[employeeKey];
      const job = jobs[jobKey];
      links.set(id, await Referral.create({
        company: job.company, job: job._id, referrer: emp._id, referrerName: emp.name, referrerEmail: emp.email,
        kind: 'link', code: code(), status: 'invited', createdAt
      }));
    }
    return links.get(id);
  }

  // ---- Applications ----
  const counts = {};
  for (const spec of APPLICATIONS) {
    const job = jobs[spec.job];
    const person = people[spec.who];
    const { owner } = companies[JOBS[spec.job].company];
    const appliedAt = ago(spec.appliedAgo);
    const [score, matched, missing, summary] = spec.fit;
    const questions = job.screeningQuestions || [];
    const answers = questions.map((q, i) => ({ question: q.question, answer: spec.answers?.[i] || 'yes' }));
    const knockoutFailed = questions.some((q, i) => q.requiredAnswer !== 'any' && answers[i].answer !== q.requiredAnswer);

    // Stage history spread between applying and now.
    const stageHistory = [{ stage: 'applied', by: person._id, at: appliedAt }];
    spec.stages.forEach((stage, i) => {
      stageHistory.push({ stage, by: owner._id, at: new Date(appliedAt.getTime() + ((i + 1) / (spec.stages.length + 1)) * spec.appliedAgo) });
    });

    let source = spec.internal ? 'internal' : 'direct';
    let referral;
    let referralDoc;
    if (spec.ref) {
      const emp = people[spec.ref.by];
      if (spec.ref.kind === 'invite') {
        referralDoc = await Referral.create({
          company: job.company, job: job._id, referrer: emp._id, referrerName: emp.name, referrerEmail: emp.email,
          kind: 'invite', code: code(), candidateName: person.name, candidateEmail: person.email,
          relationship: spec.ref.relationship, note: spec.ref.note, status: 'applied',
          createdAt: new Date(appliedAt.getTime() - 6 * HOUR)
        });
      } else {
        referralDoc = await referralLink(spec.ref.by, spec.job, new Date(appliedAt.getTime() - DAY));
        referralDoc.status = 'applied';
      }
      source = 'referral';
      referral = {
        referralId: referralDoc._id, referrer: emp._id, referrerName: emp.name, referrerEmail: emp.email,
        relationship: spec.ref.relationship ? RELATIONSHIP_LABELS[spec.ref.relationship] : '', note: spec.ref.note || ''
      };
    }

    const interviews = [];
    if (spec.interview) {
      const i = spec.interview;
      interviews.push({
        scheduledAt: istDate(i.inDays, i.hourIST, i.minute), durationMins: 45, mode: i.mode, location: i.location,
        interviewers: [owner._id], interviewerNames: [owner.name], note: i.note, status: i.status || 'scheduled',
        createdBy: owner._id, createdByName: owner.name
      });
    }

    const application = await Application.create({
      job: job._id, company: job.company, candidate: person._id,
      candidateName: person.name, candidateEmail: person.email,
      resumeText: person.resume.text, resumeHash: hashText(person.resume.text), resumeName: person.resume.fileName,
      resumeFile: { mimeType: 'application/pdf', size: 84_000 },
      answers, knockoutFailed, source, referral,
      score, result: fitReport(score, matched, missing, summary), scoreStatus: 'scored',
      scoredAt: new Date(appliedAt.getTime() + 60_000), jobVersion: job.contentVersion,
      stage: spec.stages.at(-1) || 'applied', stageHistory,
      notes: (spec.notes || []).map((text, i) => ({ author: owner._id, authorName: owner.name, text, createdAt: new Date(appliedAt.getTime() + (i + 1) * 0.3 * spec.appliedAgo) })),
      interviews,
      createdAt: appliedAt
    });

    if (referralDoc) {
      referralDoc.applications.push(application._id);
      await referralDoc.save();
    }
    counts[spec.job] = (counts[spec.job] || 0) + 1;
  }
  for (const [key, count] of Object.entries(counts)) await Job.updateOne({ _id: jobs[key]._id }, { applicationCount: count });

  // ---- Pending referral invites ----
  for (const inv of PENDING_INVITES) {
    const emp = people[inv.by];
    const job = jobs[inv.job];
    await Referral.create({
      company: job.company, job: job._id, referrer: emp._id, referrerName: emp.name, referrerEmail: emp.email,
      kind: 'invite', code: code(), candidateName: inv.candidateName, candidateEmail: inv.candidateEmail,
      relationship: inv.relationship, note: inv.note, status: 'invited', createdAt: ago(inv.ago)
    });
  }

  // ---- Summary ----
  const line = (label, value) => console.log(`  ${label.padEnd(34)} ${value}`);
  console.log(`\nCreated ${Object.keys(companies).length} companies, ${Object.keys(jobs).length} jobs, ${APPLICATIONS.length} applications, ${links.size + APPLICATIONS.filter(a => a.ref?.kind === 'invite').length + PENDING_INVITES.length} referrals.\n`);
  console.log('Jobs:');
  for (const job of Object.values(jobs)) {
    console.log(`  ${job.jobCode.padEnd(9)} ${job.title.padEnd(46)} ${job.visibility.padEnd(9)} ${job.status.padEnd(7)} ${job.department} / ${job.team}${job.project ? ` / ${job.project}` : ''}`);
  }
  console.log(`\nAll passwords: ${PASSWORD}`);
  line('Employer, Nimbus Labs (Growth)', COMPANIES.nimbus.owner.email);
  line('Employer, KiranaPay (Starter)', COMPANIES.kirana.owner.email);
  line('Employee, Nimbus (refers, internal)', EMPLOYEES.ananya.email);
  line('Employee, Nimbus', `${EMPLOYEES.karan.email}, ${EMPLOYEES.divya.email}`);
  line('Employee, KiranaPay', EMPLOYEES.sneha.email);
  line('Candidate (interview tomorrow)', CANDIDATES.priya.email);
  await mongoose.disconnect();
}

seed().catch(async error => {
  console.error('Seeding failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
