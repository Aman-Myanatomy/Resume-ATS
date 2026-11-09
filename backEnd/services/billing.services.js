import crypto from 'crypto';
import Company from '../models/company.models.js';
import Job from '../models/job.models.js';
import Application from '../models/application.models.js';
import { PLANS, BILLING_PERIOD_DAYS, billingMode } from '../config/plans.config.js';
import { httpError } from '../utils/http.utils.js';

/**
 * Plans, limits and payments.
 * Usage is computed from real data (open jobs, members, scored applications this period),
 * so there are no counters to drift out of sync.
 */

/** The plan currently in force: a paid plan whose period ended falls back to Starter. */
export function effectivePlan(company) {
  const id = company?.plan || 'starter';
  if (id !== 'starter' && (!company.planRenewsAt || company.planRenewsAt < new Date())) return PLANS.starter;
  return PLANS[id] || PLANS.starter;
}

/** Start of the current usage period: the paid period start, or the calendar month for Starter. */
function periodStart(company) {
  const plan = effectivePlan(company);
  if (plan.id !== 'starter' && company.planRenewsAt) {
    return new Date(company.planRenewsAt.getTime() - BILLING_PERIOD_DAYS * 86400000);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getUsage(company) {
  const [activeJobs, scored] = await Promise.all([
    Job.countDocuments({ company: company._id, status: 'open' }),
    Application.countDocuments({ company: company._id, scoreStatus: 'scored', scoredAt: { $gte: periodStart(company) } })
  ]);
  return { activeJobs, scoredThisPeriod: scored };
}

const within = (limit, used) => limit == null || used < limit;

export async function assertCanOpenJob(company, { excludeJobId } = {}) {
  const plan = effectivePlan(company);
  if (plan.limits.activeJobs == null) return;
  const filter = { company: company._id, status: 'open' };
  if (excludeJobId) filter._id = { $ne: excludeJobId };
  const open = await Job.countDocuments(filter);
  if (open >= plan.limits.activeJobs) {
    throw httpError(402, `Your ${plan.name} plan allows ${plan.limits.activeJobs} open job${plan.limits.activeJobs === 1 ? '' : 's'}. Close a job or upgrade your plan on the Billing page.`);
  }
}

/** Used by the scoring queue before spending an AI call on an application. */
export async function canScoreForCompany(companyId) {
  const company = await Company.findById(companyId);
  if (!company) return false;
  const plan = effectivePlan(company);
  if (plan.limits.scoredPerMonth == null) return true;
  const scored = await Application.countDocuments({ company: company._id, scoreStatus: 'scored', scoredAt: { $gte: periodStart(company) } });
  return scored < plan.limits.scoredPerMonth;
}

export async function getBillingSummary(company) {
  const plan = effectivePlan(company);
  return {
    mode: billingMode(),
    razorpayKeyId: billingMode() === 'razorpay' ? process.env.RAZORPAY_KEY_ID : undefined,
    current: {
      id: plan.id,
      name: plan.name,
      limits: plan.limits,
      renewsAt: plan.id === 'starter' ? null : company.planRenewsAt,
      expiredPlan: plan.id === 'starter' && company.plan !== 'starter' ? PLANS[company.plan]?.name : null
    },
    usage: await getUsage(company),
    plans: Object.values(PLANS).map(p => ({ id: p.id, name: p.name, price: p.price, limits: p.limits, features: p.features })),
    history: (company.billingHistory || []).slice(-10).reverse().map(h => ({
      plan: PLANS[h.plan]?.name || h.plan, amount: h.amount, mode: h.mode, paidAt: h.paidAt, periodEnd: h.periodEnd
    }))
  };
}

async function activatePlan(company, { planId, mode, orderId, paymentId, userId }) {
  const plan = PLANS[planId];
  // Renewing the same active plan extends from its current end; anything else starts now.
  const base = company.plan === planId && company.planRenewsAt > new Date() ? company.planRenewsAt : new Date();
  const periodEnd = new Date(base.getTime() + BILLING_PERIOD_DAYS * 86400000);
  company.plan = planId;
  company.planRenewsAt = periodEnd;
  company.billingHistory.push({ plan: planId, amount: plan.price, mode, orderId, paymentId, paidBy: userId, periodEnd });
  if (orderId) company.pendingOrders = company.pendingOrders.filter(o => o.orderId !== orderId);
  await company.save();
}

/**
 * Starts an upgrade. Razorpay mode creates an order for the browser checkout.
 * Demo mode (never in production) activates the plan immediately without payment.
 */
export async function startCheckout(company, { planId, userId }) {
  const plan = PLANS[planId];
  if (!plan || plan.id === 'starter') throw httpError(400, 'Choose a paid plan to upgrade.');
  const mode = billingMode();

  if (mode === 'disabled') throw httpError(503, 'Payments are not configured yet. Add Razorpay keys to enable upgrades.');

  if (mode === 'demo') {
    await activatePlan(company, { planId, mode: 'demo', userId });
    return { mode, activated: true, summary: await getBillingSummary(company) };
  }

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let order;
  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: plan.price,
        currency: 'INR',
        receipt: `co_${String(company._id).slice(-8)}_${Date.now()}`,
        notes: { companyId: String(company._id), plan: plan.id }
      })
    });
    order = await response.json();
    if (!response.ok) throw new Error(order?.error?.description || 'Razorpay rejected the order.');
  } catch (error) {
    throw httpError(502, `Could not start payment: ${error.message}`);
  }

  company.pendingOrders = [...(company.pendingOrders || []).slice(-9), { orderId: order.id, plan: plan.id, amount: plan.price }];
  await company.save();
  return { mode, orderId: order.id, amount: plan.price, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID, planName: plan.name, companyName: company.name };
}

/** Verifies Razorpay's checkout signature, then activates the plan the order was created for. */
export async function verifyPayment(company, { orderId, paymentId, signature, userId }) {
  if (billingMode() !== 'razorpay') throw httpError(400, 'Payment verification is only used with Razorpay.');
  if (!orderId || !paymentId || !signature) throw httpError(400, 'Payment details are missing.');

  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const valid = expected.length === String(signature).length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  if (!valid) throw httpError(400, 'Payment could not be verified. If money was deducted, contact support with your payment ID.');

  const pending = (company.pendingOrders || []).find(o => o.orderId === orderId);
  if (!pending) {
    // Already activated (e.g. a double click) or not this company's order.
    if ((company.billingHistory || []).some(h => h.orderId === orderId)) return getBillingSummary(company);
    throw httpError(400, 'This payment does not match an upgrade started by your company.');
  }
  await activatePlan(company, { planId: pending.plan, mode: 'razorpay', orderId, paymentId, userId });
  return getBillingSummary(company);
}

/** Switches back to Starter immediately (MVP: no proration or refunds). */
export async function downgradeToStarter(company) {
  company.plan = 'starter';
  company.planRenewsAt = undefined;
  await company.save();
  return getBillingSummary(company);
}
