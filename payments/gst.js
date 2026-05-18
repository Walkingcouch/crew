'use strict';

/**
 * payments/gst.js
 *
 * Australian GST (10%) ledger math and itemised display for Crew.
 *
 * All internal values are in integer cents to avoid floating-point drift.
 * Every exported function is pure — no side effects, no I/O.
 *
 * GST rules applied here:
 *   1. Prices displayed to the customer are GST-inclusive (incl. GST).
 *   2. GST component  = inclusive_amount / 11        (exact, rounded half-up)
 *   3. Ex-GST amount  = inclusive_amount - gst        (exact remainder)
 *   4. Platform commission is applied to the ex-GST job value to avoid
 *      stacking GST on top of GST (ATO-compliant agent arrangement).
 *   5. The commission fee itself attracts GST (Crew's supply to the contractor).
 *
 * Commission tiers:
 *   STANDARD   — sole traders  (crew_member role):  10%
 *   ENTERPRISE — B2B accounts  (crew_manager/org):   6%
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const GST_RATE = 0.10;                 // 10% Australian GST
const GST_DIVISOR = 11;                // GST component from inclusive price = price / 11

const COMMISSION_RATES = Object.freeze({
  standard:   0.10,   // 10%
  enterprise: 0.06,   //  6%
});

// Role → commission tier mapping (mirrors Supabase profiles.role values)
const ROLE_TIER_MAP = Object.freeze({
  crew_member:    'standard',
  crew_manager:   'enterprise',
  field_worker:   'standard',
  supervisor:     'enterprise',
  crewbase_admin: 'enterprise',
  customer:       null,    // customers are not charged commission
  admin:          null,
});

// ── Rounding helper ───────────────────────────────────────────────────────────
// "Half-up" rounding is required by ATO GST guidance for invoice rounding.
function roundHalfUp(n) {
  return Math.floor(n + 0.5);
}

// ── Core primitives (all amounts in cents) ────────────────────────────────────

/**
 * Extract the GST component from a GST-inclusive amount.
 * e.g. $110.00 → $10.00
 */
function gstComponent(inclusiveCents) {
  return roundHalfUp(inclusiveCents / GST_DIVISOR);
}

/**
 * Extract the ex-GST (net) amount from a GST-inclusive amount.
 * e.g. $110.00 → $100.00
 */
function exGst(inclusiveCents) {
  return inclusiveCents - gstComponent(inclusiveCents);
}

/**
 * Convert a dollar amount (number or string like "110.00") to integer cents.
 * Handles string inputs from frontend form fields.
 */
function dollarsToCents(dollars) {
  const n = parseFloat(String(dollars).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) throw new TypeError(`Invalid dollar amount: ${dollars}`);
  return roundHalfUp(n * 100);
}

/**
 * Format integer cents as an AUD currency string.
 * e.g. 11000 → "$110.00"
 */
function formatAUD(cents) {
  const sign  = cents < 0 ? '-' : '';
  const abs   = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac  = String(abs % 100).padStart(2, '0');
  return `${sign}$${whole.toLocaleString('en-AU')}.${frac}`;
}

/**
 * Tier string for a given role, defaulting to 'standard'.
 */
function tierForRole(role) {
  return ROLE_TIER_MAP[role] || 'standard';
}

/**
 * Commission rate (0–1) for a tier string.
 */
function commissionRate(tier) {
  return COMMISSION_RATES[tier] ?? COMMISSION_RATES.standard;
}

// ── Commission calculation ────────────────────────────────────────────────────

/**
 * Calculate the platform commission (inclusive of GST) on a job.
 *
 * Commission is applied to the ex-GST job value:
 *   commission_ex_gst  = exGst(jobTotal) × rate
 *   commission_inc_gst = commission_ex_gst × 1.10     (commission attracts its own GST)
 *
 * This is what Zai routes to Crew's platform account as the fee amount.
 *
 * @param  {number} jobTotalCents  Total charged to customer, GST-inclusive, in cents
 * @param  {string} tier           'standard' | 'enterprise'
 * @returns {{ exGstCents, gstCents, incGstCents, rate }}
 */
function commissionCalc(jobTotalCents, tier) {
  const rate           = commissionRate(tier);
  const jobExGst       = exGst(jobTotalCents);
  const commExGst      = roundHalfUp(jobExGst * rate);
  const commGst        = roundHalfUp(commExGst * GST_RATE);
  const commIncGst     = commExGst + commGst;

  return {
    rate,
    exGstCents:  commExGst,
    gstCents:    commGst,
    incGstCents: commIncGst,
  };
}

/**
 * Calculate what the contractor receives after platform commission.
 *
 * @param  {number} jobTotalCents  GST-inclusive job total in cents
 * @param  {string} tier           'standard' | 'enterprise'
 * @returns {{ exGstCents, gstCents, incGstCents }}
 */
function contractorPayout(jobTotalCents, tier) {
  const comm            = commissionCalc(jobTotalCents, tier);
  const payoutIncGst    = jobTotalCents - comm.incGstCents;
  const payoutGst       = gstComponent(payoutIncGst);
  const payoutExGst     = exGst(payoutIncGst);

  return {
    incGstCents: payoutIncGst,
    gstCents:    payoutGst,
    exGstCents:  payoutExGst,
  };
}

// ── Full itemised ledger ──────────────────────────────────────────────────────

/**
 * Build a complete itemised GST ledger for a job payment.
 *
 * Used by:
 *   - Checkout summary screen (frontend display)
 *   - Tax invoice generation
 *   - Transaction history ledger
 *   - Zai fee-amount calculation
 *
 * @param {object} params
 * @param {number} params.jobTotalCents    Total customer charge (GST-inclusive), in cents
 * @param {string} params.tier             'standard' | 'enterprise'
 * @param {string} params.serviceName      e.g. "Standard Lawn Mow"
 * @param {string} params.contractorName   e.g. "Green Thumb Co."
 * @param {string} params.bookingRef       e.g. "BK-2026-00142"
 * @param {string} [params.dateISO]        ISO date string (defaults to now)
 *
 * @returns {LedgerObject}
 */
function buildLedger({ jobTotalCents, tier, serviceName, contractorName, bookingRef, dateISO }) {
  if (!Number.isInteger(jobTotalCents) || jobTotalCents <= 0) {
    throw new RangeError(`jobTotalCents must be a positive integer, got: ${jobTotalCents}`);
  }

  const date      = dateISO ? new Date(dateISO) : new Date();
  const tierLabel = tier === 'enterprise' ? 'Enterprise' : 'Standard';
  const rate      = commissionRate(tier);

  // ─ Job total breakdown
  const jobGst    = gstComponent(jobTotalCents);
  const jobExGst  = exGst(jobTotalCents);

  // ─ Platform commission
  const comm = commissionCalc(jobTotalCents, tier);

  // ─ Contractor payout
  const payout = contractorPayout(jobTotalCents, tier);

  // ─ Verification totals (must sum correctly)
  if (comm.incGstCents + payout.incGstCents !== jobTotalCents) {
    // Rounding edge: adjust contractor payout by 1 cent to keep totals exact
    payout.incGstCents = jobTotalCents - comm.incGstCents;
    payout.gstCents    = gstComponent(payout.incGstCents);
    payout.exGstCents  = exGst(payout.incGstCents);
  }

  return {
    // ─ Metadata
    bookingRef,
    serviceName,
    contractorName,
    tier: tierLabel,
    commissionRate: `${(rate * 100).toFixed(0)}%`,
    date: date.toISOString(),

    // ─ Customer-facing line items
    customerCharge: {
      label:       'Service total (GST incl.)',
      incGstCents: jobTotalCents,
      gstCents:    jobGst,
      exGstCents:  jobExGst,
    },

    // ─ Platform commission (routes to Crew's Zai account)
    platformFee: {
      label:       `Crew platform fee (${(rate * 100).toFixed(0)}% of ex-GST service value)`,
      exGstCents:  comm.exGstCents,
      gstCents:    comm.gstCents,
      incGstCents: comm.incGstCents,
      // This is the exact amount to pass to Zai as the fee
      zaiFeeCents: comm.incGstCents,
    },

    // ─ Contractor payout (routes to contractor's Zai disbursement account)
    contractorPayout: {
      label:       `Payout to ${contractorName}`,
      exGstCents:  payout.exGstCents,
      gstCents:    payout.gstCents,
      incGstCents: payout.incGstCents,
    },

    // ─ GST summary (for tax invoice)
    gstSummary: {
      totalGst:            jobGst,
      gstOnServiceValue:   jobGst - comm.gstCents,   // customer's GST component net of fee
      gstOnPlatformFee:    comm.gstCents,
      gstRemittedByCrew:   jobGst,                   // Crew remits entire GST to ATO
    },

    // ─ Formatted display strings (for UI rendering)
    display: {
      customerCharge:   formatAUD(jobTotalCents),
      customerGst:      formatAUD(jobGst),
      customerExGst:    formatAUD(jobExGst),
      platformFee:      formatAUD(comm.incGstCents),
      platformFeeGst:   formatAUD(comm.gstCents),
      platformFeeExGst: formatAUD(comm.exGstCents),
      contractorPayout: formatAUD(payout.incGstCents),
      contractorGst:    formatAUD(payout.gstCents),
      contractorExGst:  formatAUD(payout.exGstCents),
    },
  };
}

/**
 * Serialise a ledger to plain-text line items suitable for email/SMS receipts.
 *
 * @param {LedgerObject} ledger
 * @param {'customer'|'contractor'|'admin'} audience
 * @returns {string}
 */
function ledgerToText(ledger, audience = 'customer') {
  const lines = [
    `Booking:        ${ledger.bookingRef}`,
    `Service:        ${ledger.serviceName}`,
    `Date:           ${new Date(ledger.date).toLocaleDateString('en-AU', { dateStyle: 'long' })}`,
    `─────────────────────────────────────`,
  ];

  if (audience === 'customer' || audience === 'admin') {
    lines.push(
      `Service total:  ${ledger.display.customerCharge}`,
      `  GST (10%):   ${ledger.display.customerGst}`,
      `  Ex-GST:      ${ledger.display.customerExGst}`,
    );
  }

  if (audience === 'contractor' || audience === 'admin') {
    lines.push(
      `─────────────────────────────────────`,
      `Platform fee (${ledger.commissionRate}): ${ledger.display.platformFee}`,
      `  GST on fee:  ${ledger.display.platformFeeGst}`,
      `  Fee ex-GST:  ${ledger.display.platformFeeExGst}`,
      `─────────────────────────────────────`,
      `Your payout:    ${ledger.display.contractorPayout}`,
      `  GST component:${ledger.display.contractorGst}`,
      `  Ex-GST:       ${ledger.display.contractorExGst}`,
    );
  }

  if (audience === 'admin') {
    lines.push(
      `─────────────────────────────────────`,
      `Total GST remitted to ATO: ${formatAUD(ledger.gstSummary.totalGst)}`,
      `Contractor: ${ledger.contractorName} (${ledger.tier} tier)`,
    );
  }

  lines.push(`─────────────────────────────────────`);
  return lines.join('\n');
}

/**
 * Verify that a ledger's internal totals are arithmetically consistent.
 * Throws if totals don't balance to within 1 cent (rounding tolerance).
 *
 * @param {LedgerObject} ledger
 */
function assertLedgerValid(ledger) {
  const { customerCharge, platformFee, contractorPayout } = ledger;

  const splitSum = platformFee.incGstCents + contractorPayout.incGstCents;
  const diff     = Math.abs(splitSum - customerCharge.incGstCents);

  if (diff > 1) {
    throw new Error(
      `Ledger integrity check failed: ` +
      `fee(${platformFee.incGstCents}) + payout(${contractorPayout.incGstCents}) = ` +
      `${splitSum} ≠ charge(${customerCharge.incGstCents}). Diff: ${diff} cents.`
    );
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  GST_RATE,
  GST_DIVISOR,
  COMMISSION_RATES,
  ROLE_TIER_MAP,

  gstComponent,
  exGst,
  dollarsToCents,
  formatAUD,
  tierForRole,
  commissionRate,
  commissionCalc,
  contractorPayout,
  buildLedger,
  ledgerToText,
  assertLedgerValid,
};
