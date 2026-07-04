'use strict';

/**
 * payments/onboarding.js
 *
 * CheckVault seller (contractor/organisation) onboarding for Crew.
 *
 * Two paths:
 *   A. SOLE TRADER (crew_member, field_worker): individual ABN holder.
 *   B. ENTERPRISE CONTRACTOR (crew_manager / org admin): registered company,
 *      each with its own beneficial owners, isolated from sole-trader
 *      accounts in the provider's reporting and compliance.
 *
 * profiles.kyc_status / organisations.kyb_status use the enum defined in the
 * Phase 5 migration: 'pending' | 'requires_action' | 'verified' | 'failed'.
 *
 * CheckVault's own KYC/KYB field names and verification flow are unconfirmed
 * (no public API docs yet), so the payload shape sent to the provider is
 * kept generic here and the provider-specific mapping lives entirely in
 * payments/checkvault-client.js, tagged // CHECKVAULT-SPEC.
 */

const { getProvider } = require('./index');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

const KYC_STATUS = Object.freeze({
  PENDING:         'pending',
  REQUIRES_ACTION: 'requires_action',
  VERIFIED:        'verified',
  FAILED:          'failed',
});

// ── Input validators (provider-agnostic, unchanged) ──────────────────────────
function validateABN(abn) {
  const n = String(abn).replace(/\s/g, '');
  if (!/^\d{11}$/.test(n)) throw new RangeError(`Invalid ABN format: ${abn}. Must be 11 digits.`);
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits  = n.split('').map(Number);
  digits[0] -= 1;
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  if (sum % 89 !== 0) throw new RangeError(`ABN check-digit failed: ${abn}`);
  return n;
}

function validateACN(acn) {
  const n = String(acn).replace(/\s/g, '');
  if (!/^\d{9}$/.test(n)) throw new RangeError(`Invalid ACN format: ${acn}. Must be 9 digits.`);
  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  const check   = parseInt(n[8], 10);
  const sum     = n.slice(0, 8).split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
  const rem     = (10 - (sum % 10)) % 10;
  if (rem !== check) throw new RangeError(`ACN check-digit failed: ${acn}`);
  return n;
}

function validateDOB(dob) {
  let d;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
    const [day, mon, yr] = dob.split('/');
    d = new Date(`${yr}-${mon}-${day}`);
  } else {
    d = new Date(dob);
  }
  if (isNaN(d.getTime())) throw new RangeError(`Invalid date of birth: ${dob}`);
  const minAge = new Date();
  minAge.setFullYear(minAge.getFullYear() - 18);
  if (d > minAge) throw new RangeError('Account holder must be at least 18 years old');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function normalisePhone(phone) {
  let p = String(phone).replace(/\s/g, '');
  if (p.startsWith('0')) p = '+61' + p.slice(1);
  if (!/^\+61[2-9]\d{8}$/.test(p)) throw new RangeError(`Invalid Australian mobile: ${phone}`);
  return p;
}

// Maps whatever status string the provider returns onto our DB-constrained enum.
function mapProviderStatusToKycStatus(providerStatus) {
  const s = String(providerStatus || '').toLowerCase();
  if (['verified', 'approved', 'active'].includes(s)) return KYC_STATUS.VERIFIED;
  if (['failed', 'rejected', 'declined'].includes(s)) return KYC_STATUS.FAILED;
  if (['requires_action', 'action_required', 'incomplete'].includes(s)) return KYC_STATUS.REQUIRES_ACTION;
  return KYC_STATUS.PENDING;
}

// ── Path A: SOLE TRADER ONBOARDING ────────────────────────────────────────────
/**
 * @param {object} profile
 * @param {string} profile.supabaseUserId
 * @param {string} profile.firstName
 * @param {string} profile.lastName
 * @param {string} profile.email
 * @param {string} profile.mobile
 * @param {string} profile.dob
 * @param {string} profile.abn
 * @param {string} profile.addressLine1
 * @param {string} profile.city
 * @param {string} profile.state
 * @param {string} profile.postcode
 * @param {object} [profile.govId]  { type: 'drivers_licence'|'medicare', number }
 * @returns {{ providerAccountId: string, kycStatus: string }}
 */
async function onboardSoleTrader(profile) {
  const supabase = getSupabase();
  const provider  = getProvider();

  const { supabaseUserId, firstName, lastName, email, mobile, dob, abn, addressLine1, city, state, postcode, govId } = profile;

  const validABN    = validateABN(abn);
  const validDOB    = validateDOB(dob);
  const validMobile = normalisePhone(mobile);

  const kycFields = {
    first_name: firstName.trim(),
    last_name:  lastName.trim(),
    email:      email.toLowerCase().trim(),
    mobile:     validMobile,
    dob:        validDOB,
    abn:        validABN,
    address_line1: addressLine1,
    city, state,
    postcode,
    country: 'AUS',
    ...(govId?.type === 'drivers_licence' ? { drivers_licence: govId.number } : {}),
    ...(govId?.type === 'medicare' ? { medicare_number: govId.number } : {}),
  };

  const { providerAccountId, status } = await provider.createSellerAccount({ profileId: supabaseUserId, ...kycFields });
  if (!providerAccountId) throw new Error(`Seller account creation failed for ${supabaseUserId}`);

  const kycStatus = mapProviderStatusToKycStatus(status);

  await supabase.from('profiles').update({
    payment_provider:    'checkvault',
    provider_account_id: providerAccountId,
    kyc_status:          kycStatus,
    abn:                 validABN,
  }).eq('id', supabaseUserId);

  return { providerAccountId, kycStatus };
}

// ── Path B: ENTERPRISE CONTRACTOR ONBOARDING ──────────────────────────────────
/**
 * @param {object} company
 * @param {string} company.supabaseOrgId
 * @param {string} company.adminSupabaseUserId
 * @param {string} company.companyName
 * @param {string} company.acn
 * @param {string} company.abn
 * @param {string} company.registrationState
 * @param {string} company.addressLine1
 * @param {string} company.city
 * @param {string} company.state
 * @param {string} company.postcode
 * @param {string} company.phone
 * @param {string} company.email
 * @param {object[]} company.beneficialOwners  [{ firstName, lastName, email, mobile, dob, abn?, govId? }, ...]
 * @returns {{ providerAccountId: string, kybStatus: string }}
 */
async function onboardEnterpriseContractor(company) {
  const supabase = getSupabase();
  const provider  = getProvider();

  const { supabaseOrgId, adminSupabaseUserId, companyName, acn, abn, registrationState, addressLine1, city, state, postcode, email, beneficialOwners = [] } = company;

  const validACN = validateACN(acn);
  const validABN = validateABN(abn);
  if (!companyName?.trim()) throw new TypeError('companyName is required');
  if (!beneficialOwners.length) throw new TypeError('At least one beneficial owner is required');

  const primaryOwner = beneficialOwners[0];
  const validDOB = validateDOB(primaryOwner.dob);

  const kycFields = {
    company_name: companyName.trim(),
    acn: validACN,
    abn: validABN,
    registration_state: registrationState,
    address_line1: addressLine1,
    city, state, postcode,
    country: 'AUS',
    email: email.toLowerCase().trim(),
    primary_contact: {
      first_name: primaryOwner.firstName.trim(),
      last_name:  primaryOwner.lastName.trim(),
      mobile:     normalisePhone(primaryOwner.mobile),
      dob:        validDOB,
    },
    beneficial_owners: beneficialOwners.map(o => ({
      first_name: o.firstName.trim(),
      last_name:  o.lastName.trim(),
      email:      o.email.toLowerCase().trim(),
      mobile:     normalisePhone(o.mobile),
      dob:        validateDOB(o.dob),
      abn:        o.abn ? validateABN(o.abn) : undefined,
    })),
  };

  const { providerAccountId, status } = await provider.createSellerAccount({ profileId: supabaseOrgId, ...kycFields });
  if (!providerAccountId) throw new Error(`Seller account creation failed for org ${supabaseOrgId}`);

  const kybStatus = mapProviderStatusToKycStatus(status);

  await supabase.from('organisations').update({
    provider_account_id: providerAccountId,
    kyb_status:           kybStatus,
    abn:                  validABN,
  }).eq('id', supabaseOrgId);

  await supabase.from('profiles').update({
    payment_provider:    'checkvault',
    provider_account_id: providerAccountId,
    kyc_status:          kybStatus,
  }).eq('id', adminSupabaseUserId);

  return { providerAccountId, kybStatus };
}

// ── ADD DISBURSEMENT BANK ACCOUNT ─────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string} params.providerAccountId
 * @param {string} params.accountName
 * @param {string} params.bsb
 * @param {string} params.accountNumber
 * @returns {{ bankAccountId: string }}
 */
async function addDisbursementAccount({ providerAccountId, accountName, bsb, accountNumber }) {
  const provider = getProvider();
  const normBsb = String(bsb).replace(/[^0-9]/g, '');
  if (normBsb.length !== 6) throw new RangeError(`Invalid BSB: ${bsb}`);
  if (!accountNumber || String(accountNumber).length < 5) throw new RangeError('Invalid account number');

  const { bankAccountId } = await provider.attachBankAccount(providerAccountId, { accountName, bsb: normBsb, accountNumber });
  if (!bankAccountId) throw new Error('Bank account attachment failed');
  return { bankAccountId };
}

// ── GET VERIFICATION STATUS ───────────────────────────────────────────────────
/**
 * @param {string} providerAccountId
 * @returns {{ status: string, detail: string }}
 */
async function getVerificationStatus(providerAccountId) {
  const provider = getProvider();
  const res = await provider.getSellerStatus(providerAccountId);
  return { status: mapProviderStatusToKycStatus(res.status), providerStatus: res.status, detail: res.detail || null };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  KYC_STATUS,
  validateABN, validateACN, validateDOB, normalisePhone,
  onboardSoleTrader,
  onboardEnterpriseContractor,
  addDisbursementAccount,
  getVerificationStatus,
};
