import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { CheckCircle2, Info } from 'lucide-react';
import { useCheckoutMutation, useDowngradeMutation, useGetBillingQuery, useVerifyPaymentMutation } from '../../store/api/employerApi.js';
import { errorMessage, formatRupees, isCompanyAdmin } from '../../lib/format.js';
import { ErrorNote, SkeletonList } from '../../components/ui.jsx';
import PlanCards from '../../components/PlanCards.jsx';

/** Loads Razorpay's checkout script once, on demand. */
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.body.appendChild(script);
  });
}

function Meter({ label, used, limit }) {
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const tone = unlimited ? 'ok' : pct >= 100 ? 'full' : pct >= 80 ? 'near' : 'ok';
  return (
    <div className="jb-meter">
      <div className="jb-row-between">
        <span>{label}</span>
        <span className="jb-num">{used.toLocaleString('en-IN')} / {unlimited ? '∞' : limit.toLocaleString('en-IN')}</span>
      </div>
      <span className={`jb-meter-bar jb-meter-${tone}`} role="img" aria-label={`${label}: ${used} of ${unlimited ? 'unlimited' : limit}`}>
        <i style={{ width: unlimited ? '4%' : `${Math.max(pct, 2)}%` }} />
      </span>
    </div>
  );
}

export default function Billing() {
  const user = useSelector(state => state.auth.user);
  const canManage = isCompanyAdmin(user);
  const { data, error, isLoading, refetch } = useGetBillingQuery();
  const [checkout] = useCheckoutMutation();
  const [verifyPayment] = useVerifyPaymentMutation();
  const [downgrade, downgradeState] = useDowngradeMutation();
  const [busyPlan, setBusyPlan] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);

  if (isLoading) return <div className="jb-page"><SkeletonList count={3} avatar={false} label="Loading plan…" /></div>;
  if (error) return <div className="jb-page"><ErrorNote onRetry={refetch}>{errorMessage(error)}</ErrorNote></div>;

  const { current, usage, plans, mode, history } = data;

  async function upgrade(plan) {
    setBusyPlan(plan.id);
    setActionError('');
    setNotice('');
    try {
      const result = await checkout(plan.id).unwrap();
      if (result.mode === 'demo') {
        setNotice(`You're on ${plan.name} now (demo upgrade, no payment taken).`);
        return;
      }
      await loadRazorpay();
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: result.keyId,
          amount: result.amount,
          currency: result.currency,
          name: 'Resumely',
          description: `${result.planName} plan · 30 days`,
          order_id: result.orderId,
          prefill: { name: user.name, email: user.email },
          notes: { company: result.companyName },
          theme: { color: '#356b56' },
          handler: async response => {
            try {
              await verifyPayment({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature
              }).unwrap();
              setNotice(`Payment received. You're on ${plan.name} now.`);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => resolve() }
        });
        rzp.on('payment.failed', resp => reject(new Error(resp.error?.description || 'Payment failed.')));
        rzp.open();
      });
    } catch (err) {
      setActionError(errorMessage(err, 'Could not complete the upgrade.'));
    } finally {
      setBusyPlan('');
    }
  }

  async function doDowngrade() {
    setActionError('');
    try {
      await downgrade().unwrap();
      setNotice('Switched to Starter.');
      setConfirmDowngrade(false);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const busy = Boolean(busyPlan) || downgradeState.isLoading;
  const renderAction = plan => {
    const isCurrent = plan.id === current.id;
    if (!canManage) return isCurrent ? <span className="jb-plan-current">Current plan</span> : <small className="jb-muted">Ask an admin to change plans.</small>;
    if (isCurrent && plan.id === 'starter') return <span className="jb-plan-current">Current plan</span>;
    if (isCurrent) {
      return (
        <button type="button" className="jb-btn jb-btn-ghost jb-btn-block" disabled={busy || mode === 'disabled'} onClick={() => upgrade(plan)}>
          {busyPlan === plan.id ? 'Opening…' : 'Renew 30 days'}
        </button>
      );
    }
    if (plan.id !== 'starter') {
      return (
        <button type="button" className="jb-btn jb-btn-block" disabled={busy || mode === 'disabled'} onClick={() => upgrade(plan)}>
          {busyPlan === plan.id ? 'Opening…' : `Switch to ${plan.name}`}
        </button>
      );
    }
    return confirmDowngrade ? (
      <div className="jb-confirm-box">
        <p className="jb-small">Switch to Starter now? Paid time left is not refunded. Open jobs above the limit stay open, but you can't open new ones.</p>
        <div className="jb-form-actions">
          <button type="button" className="jb-btn jb-btn-sm jb-btn-danger" disabled={downgradeState.isLoading} onClick={doDowngrade}>Switch to Starter</button>
          <button type="button" className="jb-link-btn" onClick={() => setConfirmDowngrade(false)}>Keep {current.name}</button>
        </div>
      </div>
    ) : (
      <button type="button" className="jb-btn jb-btn-ghost jb-btn-block" onClick={() => setConfirmDowngrade(true)}>Switch to Starter</button>
    );
  };

  return (
    <div className="jb-page">
      <header className="jb-page-head">
        <div>
          <p className="eyebrow">PLAN &amp; BILLING</p>
          <h1 className="jb-h1">{current.name} plan</h1>
          <p className="intro-copy">
            {current.renewsAt
              ? `Paid until ${new Date(current.renewsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Renew any time to extend by 30 days.`
              : 'Free forever. Upgrade when you need more open jobs or AI scoring.'}
          </p>
        </div>
      </header>

      {mode === 'demo' && (
        <p className="jb-demo-note"><Info size={15} aria-hidden="true" /> Demo mode: payments aren't connected yet, so upgrades activate instantly without charging. Add Razorpay keys to the server to take real payments.</p>
      )}
      {mode === 'disabled' && <p className="jb-demo-note"><Info size={15} aria-hidden="true" /> Upgrades are temporarily unavailable. Contact support to change your plan.</p>}
      {current.expiredPlan && <p className="jb-demo-note"><Info size={15} aria-hidden="true" /> Your {current.expiredPlan} plan has ended, so Starter limits apply. Renew below.</p>}
      {notice && <p className="jb-success" role="status"><CheckCircle2 size={16} aria-hidden="true" /> {notice}</p>}
      <ErrorNote>{actionError}</ErrorNote>

      <section className="jb-card jb-usage">
        <h2 className="jb-h3">Usage this period</h2>
        <Meter label="Open jobs" used={usage.activeJobs} limit={current.limits.activeJobs} />
        <Meter label="AI-scored applicants" used={usage.scoredThisPeriod} limit={current.limits.scoredPerMonth} />
        <p className="jb-muted jb-small">When AI scoring runs out, new applications still arrive. They are scored after you upgrade (use "Score now" on the applicant).</p>
      </section>

      <PlanCards plans={plans} currentId={current.id} renderAction={renderAction} />

      {history.length > 0 && (
        <section className="jb-card">
          <h2 className="jb-h3">Payment history</h2>
          <div className="jb-table-wrap">
            <table className="jb-table">
              <thead><tr><th scope="col">Date</th><th scope="col">Plan</th><th scope="col">Amount</th><th scope="col">Valid until</th><th scope="col">Type</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td>{new Date(h.paidAt).toLocaleDateString('en-IN')}</td>
                    <td>{h.plan}</td>
                    <td className="jb-num">{formatRupees(h.amount)}</td>
                    <td>{h.periodEnd ? new Date(h.periodEnd).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{h.mode === 'demo' ? 'Demo (no charge)' : 'Razorpay'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
