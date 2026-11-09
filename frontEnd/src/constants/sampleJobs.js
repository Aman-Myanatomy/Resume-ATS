/**
 * Ready-made jobs for demos and for employers who want a starting point.
 * Values use the job form's shape (salary in LPA as text, skills comma-separated).
 */
export const SAMPLE_JOBS = [
  {
    title: 'Backend Engineer (Node.js)',
    department: 'Engineering', team: 'Payments', project: '', hiringManager: 'Rahul Verma', openings: '2', referralBonus: '₹40,000 after 90 days',
    location: 'Pune',
    workMode: 'hybrid',
    employmentType: 'full_time',
    experienceMin: '2',
    experienceMax: '5',
    salaryMinLpa: '12',
    salaryMaxLpa: '22',
    skills: 'Node.js, Express, MongoDB, Redis, AWS, REST APIs',
    description: `## What you will do
- Design and build REST APIs in Node.js and Express used by thousands of customers
- Model data in MongoDB and add caching with Redis for high-traffic endpoints
- Own services end to end: testing, monitoring and on-call for what you ship
- Review code and help shape our engineering practices

## What we're looking for
- **2–5 years** building production backend services in Node.js
- Strong understanding of MongoDB schema design and indexing
- Experience with Redis, queues and AWS (S3, Lambda, SQS)
- Clear written communication; you will write short design docs

## Nice to have
- Docker and CI/CD pipelines
- Experience in a fast-growing startup`,
    screeningQuestions: [
      { question: 'Do you have 2+ years of professional backend experience?', requiredAnswer: 'yes' },
      { question: 'Can you work from our Pune office 3 days a week?', requiredAnswer: 'yes' },
      { question: 'Can you join within 30 days?', requiredAnswer: 'any' }
    ]
  },
  {
    title: 'Product Designer',
    department: 'Design', team: 'Growth', project: '', hiringManager: '', openings: '1', referralBonus: '',
    location: 'Bengaluru',
    workMode: 'onsite',
    employmentType: 'full_time',
    experienceMin: '3',
    experienceMax: '6',
    salaryMinLpa: '15',
    salaryMaxLpa: '26',
    skills: 'Figma, User research, Prototyping, Design systems, Interaction design',
    description: `## What you will do
- Turn customer problems into simple, usable flows across web and mobile
- Run usability sessions and share clear findings with the team
- Build high-fidelity prototypes in Figma and hand off with care
- Grow and maintain our design system

## What we're looking for
- **3–6 years** designing digital products, with a portfolio of shipped work
- Strong interaction design and visual craft
- Comfort running user research and acting on it
- Experience working closely with engineers and product managers

## Nice to have
- Experience designing for Indian users and low-bandwidth conditions
- Basic HTML/CSS knowledge`,
    screeningQuestions: [
      { question: 'Do you have a portfolio link you can share?', requiredAnswer: 'yes' },
      { question: 'Are you comfortable working from our Bengaluru office 5 days a week?', requiredAnswer: 'yes' }
    ]
  },
  {
    title: 'Sales Executive (Field)',
    department: 'Sales', team: 'Mumbai Field Sales', project: '', hiringManager: '', openings: '5', referralBonus: '₹10,000 after 60 days',
    location: 'Mumbai',
    workMode: 'onsite',
    employmentType: 'full_time',
    experienceMin: '1',
    experienceMax: '3',
    salaryMinLpa: '4',
    salaryMaxLpa: '6.5',
    skills: 'B2B sales, Lead generation, Negotiation, CRM, Hindi, Marathi',
    description: `## What you will do
- Visit small businesses across Mumbai and demo our product
- Build a pipeline of new merchants and close deals every month
- Keep accurate records of visits and deals in our CRM
- Share customer feedback with the product team

## What we're looking for
- **1–3 years** in field or B2B sales
- Fluent in Hindi and Marathi; English is a plus
- Comfortable travelling across the city every day
- A two-wheeler and a valid driving licence

## What we offer
- Fixed salary plus monthly incentives
- Travel allowance and fuel reimbursement`,
    screeningQuestions: [
      { question: 'Do you have a two-wheeler and a valid driving licence?', requiredAnswer: 'yes' },
      { question: 'Are you fluent in Hindi and Marathi?', requiredAnswer: 'yes' }
    ]
  }
];
