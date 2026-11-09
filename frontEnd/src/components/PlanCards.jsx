import React from 'react';
import { Check } from 'lucide-react';
import { formatRupees } from '../lib/format.js';

/**
 * Plan cards used on the landing page and the billing page.
 * `renderAction(plan)` supplies each card's button/link.
 */
export default function PlanCards({ plans = [], currentId, renderAction }) {
  return (
    <div className="jb-plans">
      {plans.map(plan => (
        <article key={plan.id} className={`jb-card jb-plan ${plan.id === currentId ? 'current' : ''} ${plan.id === 'growth' ? 'popular' : ''}`}>
          {plan.id === 'growth' && <span className="jb-plan-tag">Most popular</span>}
          <h3 className="jb-h3">{plan.name}</h3>
          <p className="jb-plan-price">{plan.price ? formatRupees(plan.price) : '₹0'}<small> / month</small></p>
          <p className="jb-plan-blurb">
            {plan.id === 'starter' && 'For your first hires. Free forever.'}
            {plan.id === 'growth' && 'For startups hiring every month.'}
            {plan.id === 'scale' && 'For agencies and high-volume teams.'}
          </p>
          <ul className="jb-check-list">
            {plan.features.map(f => <li key={f}><Check size={15} aria-hidden="true" />{f}</li>)}
          </ul>
          {renderAction?.(plan)}
        </article>
      ))}
    </div>
  );
}
