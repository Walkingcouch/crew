'use strict';

/**
 * payments/onboarding.js
 *
 * Zai sub-merchant onboarding for Crew contractors.
 *
 * Two distinct paths:
 *
 *   A. SOLE TRADER  (crew_member, field_worker)
 *      ───────────────────────────────────────
 *      Individual ABN holder.  Zai identity verification required:
 *        - Full legal name
 *        - Date of birth
 *        - Australian mobile
 *        - Government ID (driver's licence OR Medicare number)
 *        - ABN (validated via Zai KYC service)
 *      Commission rate: 10% (STANDARD tier)
 *      Payout: personal bank account via direct debit authority
 *
 *   B. ENTERPRISE CONTRACTOR  (crew_manager, org admin)
 *      ──────────────────────────────────────────────────
 *      Registered company (Pty Ltd, unit trust, etc.).  Zai KYB required:
 *        - Legal company name
 *        - ACN (Australian Company Number, 9 digits)
 *        - ABN (11 digits)
 *        - Registered office address
 *        - Beneficial owner(s): name, DOB, government ID for each ≥ 25% owner
 *        - Company bank account for disbursements
 *      Commission rate: 6% (ENTERPRISE tier)
 *      Payout: company bank account via direct debit authority
 *      Sub-merchant structure: separate Zai company user; isolated from
 *        sole-trader accounts in reporting and compliance.
 *
 * Onboarding states in Supabase profiles.zai_kyc_status:
 *   PENDING → SUBMITTED → UNDER_REVIEW → VERIFIED | FAILED | REQUIRES_ACTION
 *
 * Required env vars
 * ──────────────────
 *   ZAI_PLATFORM_ACCOUNT_ID
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */

const zai  = require('./zai-client');
const gst  = require('./gst');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ── KYC/KYB status constants ──────────────────────────────────────────────────
const KYC_STATUS = Object.freeze({
  PENDING:          'PENDING',
  SUBMITTED:        'SUBMITTED',
  UNDER_REVIEW:     'UNDER_REVIEW',
  VERIFIED:         'VERIFIED',
  FAILED:           'FAILED',
  REQUIRES_ACTION:  'REQUIRES_ACTION',
});

// ── Input validators ──────────────────────────────────────────────────────────
function validateABN(abn) {
  const n = String(abn).replace(/\s/g, '');
  if (!/^\d{11}$/.test(n)) throw new RangeError(`Invalid ABN format: ${abn}. Must be 11 digits.`);
  // ATO weighted check-digit algorithm
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits  = n.split('').map(Number);
  digits[0] -= 1;  // subtract 1 from first digit per ATO algorithm
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  if (sum % 89 !== 0) throw new RangeError(`ABN check-digit failed: ${abn}`);
  return n;
}

function validateACN(acn) {
  const n = String(acn).replace(/\s/g, '');
  if (!/^\d{9}$/.test(n)) throw new RangeError(`Invalid ACN format: ${acn}. Must be 9 digits.`);
  // ASIC weighted check-digit
  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  const check   = parseInt(n[8], 10);
  const sum     = n.slice(0, 8).split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
  const rem     = (10 - (sum % 10)) % 10;
  if (rem !== check) throw new RangeError(`ACN check-digit failed: ${acn}`);
  return n;
}

function validateDOB(dob) {
  // Accepts 'DD/MM/YYYY' (Zai format) or ISO 'YYYY-MM-DD'
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
  // Return in Zai format DD/MM/YYYY
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

// ── Path A: SOLE TRADER ONBOARDING ────────────────────────────────────────────
/**
 * Creates a Zai user for an individual contractor and submits identity data
 * for KYC verification.  Also creates a Supabase profile update with the
 * resulting Zai user ID and KYC status.
 *
 * @param {object} profile                  Supabase profile row or equivalent
 * @param {string} profile.supabaseUserId
 * @param {string} profile.firstName
 * @param {string} profile.lastName
 * @param {string} profile.email
 * @param {string} profile.mobile           Australian mobile, any format
 * @param {string} profile.dob              'DD/MM/YYYY' or 'YYYY-MM-DD'
 * @param {string} profile.abn              11-digit ABN (spaces allowed)
 * @param {string} profile.addressLine1
 * @param {string} profile.city
 * @param {string} profile.state            e.g. 'VIC'
 * @param {string} profile.postcode
 * @param {object} [profile.govId]          Optional: { type: 'drivers_licence'|'medicare', number: '...' }
 *
 * @returns {{ zaiUserId: string, kycStatus: string }}
 */
async function onboardSoleTrader(profile) {
  const supabase = getSupabase();

  const {
    supabaseUserId, firstName, lastName, email, mobile,
    dob, abn, addressLine1, city, state, postcode, govId,
  } = profile;

  // ─ Validate inputs ──────────────────────────────────────────────────────────
  const validABN    = validateABN(abn);
  const validDOB    = validateDOB(dob);
  const validMobile = normalisePhone(mobile);

  // ─ Build Zai user payload ──────────────────────────────────────────────────
  const zaiPayload = {
    id:              supabaseUserId,          // use Supabase UUID as Zai user ID
    first_name:      firstName.trim(),
    last_name:       lastName.trim(),
    email:           email.toLowerCase().trim(),
    mobile:          validMobile,
    dob:             validDOB,
    government_number: validABN,             // ABN in the government_number field
    address_line1:   addressLine1,
    city,
    state,
    zip:             postcode,
    country:         'AUS',
  };

  // Optionally attach government ID for KYC
  if (govId?.type === 'drivers_licence') {
    zaiPayload.drivers_license = govId.number;
  } else if (govId?.type === 'medicare') {
    zaiPayload.medicare_number = govId.number;
  }

  // ─ Create Zai user ──────────────────────────────────────────────────────────
  let zaiUser;
  try {
    const res = await zai.createUser(zaiPayload);
    zaiUser = res?.users;
  } catch (err) {
    if (err.statusCode === 422) {
      // User may already exist — fetch instead
      const existing = await zai.getUser(supabaseUserId);
      zaiUser = existing?.users;
    } else {
      throw err;
    }
  }

  if (!zaiUser?.id) throw new Error(`Zai user creation failed for ${supabaseUserId}`);

  // ─ Trigger KYC verification ─────────────────────────────────────────────────
  let kycStatus = KYC_STATUS.SUBMITTED;
  try {
    await zai.verifyUser(zaiUser.id, {
      government_number: validABN,
      // Zai auto-starts KYC on user creation for AU accounts when DOB + govt# provided
    });
    kycStatus = KYC_STATUS.UNDER_REVIEW;
  } catch (kycErr) {
    console.warn('[Onboarding] KYC trigger warning:', kycErr.message);
    // Non-fatal — KYC can be re-triggered via retriggerKYC()
  }

  // ─ Persist to Supabase ──────────────────────────────────────────────────────
  await supabase
    .from('profiles')
    .update({
      zai_user_id:       zaiUser.id,
      zai_kyc_status:    kycStatus,
      zai_onboarded_at:  new Date().toISOString(),
      zai_account_type:  'sole_trader',
      abn:               validABN,
      tier:              'standard',
    })
    .eq('id', supabaseUserId);

  return { zaiUserId: zaiUser.id, kycStatus };
}

// ── Path B: ENTERPRISE CONTRACTOR ONBOARDING ──────────────────────────────────
/**
 * Creates a Zai company user for an enterprise contractor (Pty Ltd etc.)
 * and submits KYB (Know Your Business) documents for corporate verification.
 *
 * Each enterprise account is a separate Zai sub-merchant — completely isolated
 * from sole-trader accounts in Zai's reporting, compliance, and escrow ledgers.
 *
 * @param {object} company
 * @param {string} company.supabaseOrgId          Supabase organisation UUID
 * @param {string} company.adminSupabaseUserId     Crew account of the admin user
 * @param {string} company.companyName             Legal registered name
 * @param {string} company.acn                     9-digit ACN
 * @param {string} company.abn                     11-digit ABN
 * @param {string} company.registrationState       e.g. 'VIC'
 * @param {string} company.addressLine1
 * @param {string} company.city
 * @param {string} company.state
 * @param {string} company.postcode
 * @param {string} company.phone                   Business phone
 * @param {string} company.email                   Primary accounts email
 * @param {object[]} company.beneficialOwners       Array of owner objects (see below)
 *
 * beneficialOwner shape:
 *   { firstName, lastName, email, mobile, dob, abn?, govId? }
 *   (Each owner with ≥ 25% shareholding must be listed)
 *
 * @returns {{ zaiCompanyUserId: string, kybStatus: string }}
 */
async function onboardEnterpriseContractor(company) {
  const supabase = getSupabase();

  const {
    supabaseOrgId, adminSupabaseUserId, companyName, acn, abn,
    registrationState, addressLine1, city, state, postcode, phone, email,
    beneficialOwners = [],
  } = company;

  // ─ Validate ─────────────────────────────────────────────────────────────────
  const validACN = validateACN(acn);
  const validABN = validateABN(abn);
  if (!companyName?.trim()) throw new TypeError('companyName is required');
  if (!beneficialOwners.length) throw new TypeError('At least one beneficial owner is required');

  // ─ Create Zai company user ──────────────────────────────────────────────────
  // Zai identifies company accounts by the presence of company_name + business_registration_number
  const companyZaiId = `org_${supabaseOrgId.replace(/-/g, '')}`;

  const adminUser = beneficialOwners[0];  // Primary contact = first owner
  const validDOB  = validateDOB(adminUser.dob);

  const zaiPayload = {
    id:                          companyZaiId,
    first_name:                  adminUser.firstName.trim(),
    last_name:                   adminUser.lastName.trim(),
    email:                       email.toLowerCase().trim(),
    mobile:                      normalisePhone(adminUser.mobile),
    dob:                         validDOB,
    government_number:           validABN,
    company_name:                companyName.trim(),
    business_registration_number: validACN,
    business_registration_state: registrationState,
    address_line1:               addressLine1,
    city,
    state,
    zip:                         postcode,
    country:                     'AUS',
  };

  if (adminUser.govId?.type === 'drivers_licence') {
    zaiPayload.drivers_license = adminUser.govId.number;
  }

  let zaiCompanyUser;
  try {
    const res = await zai.createUser(zaiPayload);
    zaiCompanyUser = res?.users;
  } catch (err) {
    if (err.statusCode === 422) {
      const existing = await zai.getUser(companyZaiId);
      zaiCompanyUser = existing?.users;
    } else {
      throw err;
    }
  }
  if (!zaiCompanyUser?.id) throw new Error(`Zai company user creation failed for org ${supabaseOrgId}`);

  // ─ Register additional beneficial owners (if multiple) ─────────────────────
  const ownerZaiIds = [zaiCompanyUser.id];
  for (let i = 1; i < beneficialOwners.length; i++) {
    const owner = beneficialOwners[i];
    try {
      const ownerRes = await zai.createUser({
        id:              `${companyZaiId}_owner${i}`,
        first_name:      owner.firstName.trim(),
        last_name:       owner.lastName.trim(),
        email:           owner.email.toLowerCase().trim(),
        mobile:          normalisePhone(owner.mobile),
        dob:             validateDOB(owner.dob),
        government_number: owner.abn ? validateABN(owner.abn) : undefined,
        address_line1:   addressLine1,
        city, state,
        zip:             postcode,
        country:         'AUS',
      });
      if (ownerRes?.users?.id) ownerZaiIds.push(ownerRes.users.id);
    } catch (ownerErr) {
      console.warn(`[Onboarding] Beneficial owner ${i} create warning:`, ownerErr.message);
    }
  }

  // ─ Trigger KYB ──────────────────────────────────────────────────────────────
  let kybStatus = KYC_STATUS.SUBMITTED;
  try {
    await zai.verifyUser(zaiCompanyUser.id, {
      government_number:           validABN,
      business_registration_number: validACN,
    });
    kybStatus = KYC_STATUS.UNDER_REVIEW;
  } catch (kybErr) {
    console.warn('[Onboarding] KYB trigger warning:', kybErr.message);
  }

  // ─ Persist to Supabase ──────────────────────────────────────────────────────
  await supabase
    .from('organisations')
    .update({
      zai_company_user_id:  zaiCompanyUser.id,
      zai_kyb_status:       kybStatus,
      zai_onboarded_at:     new Date().toISOString(),
      zai_account_type:     'enterprise',
      zai_owner_ids:        ownerZaiIds,
      acn:                  validACN,
      abn:                  validABN,
      tier:                 'enterprise',
    })
    .eq('id', supabaseOrgId);

  // Link the admin's Crew account to the org's Zai entity
  await supabase
    .from('profiles')
    .update({
      zai_user_id:      zaiCompanyUser.id,  // manager uses the company's Zai ID
      zai_kyc_status:   kybStatus,
      zai_account_type: 'enterprise',
      tier:             'enterprise',
    })
    .eq('id', adminSupabaseUserId);

  return { zaiCompanyUserId: zaiCompanyUser.id, kybStatus };
}

// ── ADD DISBURSEMENT BANK ACCOUNT ─────────────────────────────────────────────
/**
 * Links a bank account to a Zai user for receiving payouts.
 * Both sole traders and enterprise contractors must complete this before
 * they can receive escrow disbursements.
 *
 * @param {object} params
 * @param {string} params.zaiUserId
 * @param {string} params.accountName    Legal name on the bank account
 * @param {string} params.bsb            6-digit BSB
 * @param {string} params.accountNumber
 * @param {boolean} params.isBusiness    True for company bank accounts
 *
 * @returns {{ bankAccountId: string }}
 */
async function addDisbursementAccount({ zaiUserId, accountName, bsb, accountNumber, isBusiness = false }) {
  const normBsb = String(bsb).replace(/[^0-9]/g, '');
  if (normBsb.length !== 6) throw new RangeError(`Invalid BSB: ${bsb}`);

  const res = await zai.createBankAccount({
    user_id:        zaiUserId,
    account_name:   accountName,
    routing_number: normBsb,
    account_number: accountNumber,
    account_type:   isBusiness ? 'checking' : 'savings',
    country:        'AUS',
    currency:       'AUD',
    holder_type:    isBusiness ? 'business' : 'personal',
  });

  const bank = res?.bank_accounts;
  if (!bank?.id) throw new Error('Zai bank account creation failed');

  return { bankAccountId: bank.id };
}

// ── GET VERIFICATION STATUS ───────────────────────────────────────────────────
/**
 * Polls Zai for the current KYC/KYB verification level of a user.
 * Maps Zai's internal status codes to Crew's KYC_STATUS constants.
 *
 * @param {string} zaiUserId
 * @returns {{ status: string, level: number, outstanding: string[] }}
 */
async function getVerificationStatus(zaiUserId) {
  const res = await zai.getUser(zaiUserId);
  const user = res?.users;
  if (!user) throw new Error(`Zai user not found: ${zaiUserId}`);

  // Zai verification levels:
  // 0 = unverified, 1 = basic, 2 = full KYC, 3 = KYB (company)
  const level = user.verification_state || 0;

  const ZAI_LEVEL_TO_STATUS = {
    0: KYC_STATUS.PENDING,
    1: KYC_STATUS.UNDER_REVIEW,
    2: KYC_STATUS.VERIFIED,
    3: KYC_STATUS.VERIFIED,
  };

  const outstanding = [];
  if (!user.dob)              outstanding.push('date_of_birth');
  if (!user.government_number) outstanding.push('abn');
  if (!user.drivers_license && !user.medicare_number) outstanding.push('government_id');
  if (!user.mobile)           outstanding.push('mobile_number');

  return {
    status:      ZAI_LEVEL_TO_STATUS[level] || KYC_STATUS.UNDER_REVIEW,
    level,
    outstanding,
    zaiStatus:   user.verification_state,
  };
}

// ── RE-TRIGGER KYC (admin action) ────────────────────────────────────────────
/**
 * Manually re-triggers KYC/KYB after a FAILED or REQUIRES_ACTION status.
 * Typically called after the contractor has uploaded additional documents.
 *
 * @param {string} zaiUserId
 * @param {object} additionalData    Extra fields to update on the Zai user
 * @returns {{ kycStatus: string }}
 */
async function retriggerKYC(zaiUserId, additionalData = {}) {
  if (Object.keys(additionalData).length > 0) {
    await zai.updateUser(zaiUserId, additionalData);
  }
  await zai.verifyUser(zaiUserId, {});
  return { kycStatus: KYC_STATUS.UNDER_REVIEW };
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  KYC_STATUS,

  onboardSoleTrader,
  onboardEnterpriseContractor,
  addDisbursementAccount,
  getVerificationStatus,
  retriggerKYC,

  // Exported validators (used in routes for request validation)
  validateABN,
  validateACN,
  validateDOB,
  normalisePhone,
};
