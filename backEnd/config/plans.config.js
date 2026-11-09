/**
 * Subscription plans. Prices are in paise (₹1 = 100 paise), as Razorpay expects.
 * A limit of null means unlimited.
 */
export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 0,
    limits: { activeJobs: 2, scoredPerMonth: 50 },
    features: ['2 open jobs', '50 AI-scored applicants / month', 'Ranked shortlist & fit reports']
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 499900,
    limits: { activeJobs: 10, scoredPerMonth: 1000 },
    features: ['10 open jobs', '1,000 AI-scored applicants / month', 'Interview scheduling & email updates', 'AI job writer']
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    price: 1499900,
    limits: { activeJobs: null, scoredPerMonth: 5000 },
    features: ['Unlimited open jobs', '5,000 AI-scored applicants / month', 'Interview scheduling & email updates', 'Priority support']
  }
};

export const PLAN_IDS = Object.keys(PLANS);
export const BILLING_PERIOD_DAYS = 30;

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** 'razorpay' when keys exist; 'demo' (instant upgrade, no payment) only outside production; otherwise 'disabled'. */
export function billingMode() {
  if (razorpayConfigured()) return 'razorpay';
  return process.env.NODE_ENV === 'production' ? 'disabled' : 'demo';
}
