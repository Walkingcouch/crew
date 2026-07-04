'use strict';

/**
 * lib/invoices.js
 *
 * Generates the two PDFs a released booking produces: a customer tax
 * receipt and a contractor payout statement, from the same GST ledger
 * (payments/gst.js buildLedger output) used throughout checkout. Stores
 * both to the `invoices` Storage bucket, inserts the corresponding
 * `invoices` rows (invoice_number comes from the DB sequence via the
 * table's default), and emails each party their PDF via Resend.
 *
 * Idempotent by (booking_id, recipient): the invoices table has a UNIQUE
 * constraint on that pair, so calling this twice for the same booking
 * (once from escrow.releaseEscrow, once from the webhook path, in case
 * both fire) only ever produces one invoice per recipient.
 */

const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function formatDateAU(iso) {
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Renders one invoice PDF and returns it as a Buffer.
 *
 * @param {'customer'|'contractor'} recipient
 * @param {object} booking   Booking row (ref, address, created_at, ...)
 * @param {object} ledger    gst.buildLedger() output
 * @param {string} invoiceNumber  e.g. "CRW-INV-000001"
 */
function renderInvoicePdf(recipient, booking, ledger, invoiceNumber) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const isCustomer = recipient === 'customer';
    const title = isCustomer ? 'Tax Invoice / Receipt' : 'Contractor Payout Statement';

    // ── Header ──
    doc.fillColor('#1a4d33').fontSize(20).font('Helvetica-Bold').text('Crew', 50, 50);
    doc.fillColor('#000').fontSize(16).font('Helvetica-Bold').text(title, { align: 'right' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#444')
      .text('Crew Australia Pty Ltd', { align: 'right' })
      .text('ABN: 00 000 000 000', { align: 'right' })
      .text('hello@getcrew.com.au', { align: 'right' });
    doc.moveDown(1.5);

    // ── Invoice meta ──
    doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text(`Invoice number: ${invoiceNumber}`);
    doc.font('Helvetica').fontSize(10)
      .text(`Booking reference: ${booking.ref}`)
      .text(`Date: ${formatDateAU(new Date().toISOString())}`)
      .text(`Service address: ${booking.address || booking.suburb || '-'}`);
    doc.moveDown(1);

    // ── Line items ──
    const rows = isCustomer
      ? [
          ['Service total (GST incl.)', ledger.display.customerCharge],
          ['GST included (10%)', ledger.display.customerGst],
          ['Ex-GST amount', ledger.display.customerExGst],
        ]
      : [
          [`Crew platform fee (${ledger.commissionRate})`, ledger.display.platformFee],
          ['GST on platform fee', ledger.display.platformFeeGst],
          ['Your payout (GST incl.)', ledger.display.contractorPayout],
          ['GST component of payout', ledger.display.contractorGst],
        ];

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Description', 50, doc.y, { continued: true, width: 350 });
    doc.text('Amount', { align: 'right' });
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#ccc').stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(10);
    for (const [label, value] of rows) {
      doc.text(label, 50, doc.y, { continued: true, width: 350 });
      doc.text(value, { align: 'right' });
      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(12);
    const totalLabel = isCustomer ? 'Total charged' : 'Total payout';
    const totalValue = isCustomer ? ledger.display.customerCharge : ledger.display.contractorPayout;
    doc.text(totalLabel, 50, doc.y, { continued: true, width: 350 });
    doc.text(totalValue, { align: 'right' });

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(9).fillColor('#888')
      .text('Escrow by CheckVault. AFSL 429 768. Funds held in segregated Australian trust accounts.', { align: 'left' })
      .text('This document was generated automatically by the Crew platform.', { align: 'left' });

    doc.end();
  });
}

async function sendInvoiceEmail(toEmail, recipient, booking, pdfBuffer, invoiceNumber) {
  if (!process.env.RESEND_API_KEY || !toEmail) return;
  const subject = recipient === 'customer'
    ? `Your Crew tax invoice: ${booking.ref}`
    : `Your Crew payout statement: ${booking.ref}`;
  const text = recipient === 'customer'
    ? `Thanks for using Crew. Your tax invoice for booking ${booking.ref} is attached.`
    : `Your payout statement for booking ${booking.ref} is attached. Funds have been released to your account.`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Crew <invoices@getcrew.com.au>',
        to: [toEmail],
        subject,
        text,
        attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer.toString('base64') }],
      }),
    });
  } catch (err) {
    console.error(`[invoices] Resend send failed for ${recipient}:`, err.message);
  }
}

/**
 * Generates, stores, and emails both invoices for a released booking.
 * Safe to call more than once: the UNIQUE(booking_id, recipient) constraint
 * on `invoices` means a second call for an already-invoiced recipient is a
 * silent no-op for that recipient.
 *
 * @param {object} booking  Full booking row, including ledger_json, customer_id, contractor_id
 */
async function generateInvoicesForBooking(booking) {
  const supabase = getSupabase();
  const ledger = booking.ledger_json;
  if (!ledger) {
    console.warn(`[invoices] No ledger_json on booking ${booking.id}, skipping invoice generation`);
    return;
  }

  const { data: existing } = await supabase.from('invoices').select('recipient').eq('booking_id', booking.id);
  const already = new Set((existing || []).map(r => r.recipient));

  const { data: customer } = booking.customer_id
    ? await supabase.from('profiles').select('email').eq('id', booking.customer_id).single()
    : { data: null };
  const { data: contractor } = booking.contractor_id
    ? await supabase.from('profiles').select('email').eq('id', booking.contractor_id).single()
    : { data: null };

  const recipients = [
    { recipient: 'customer', profile: customer },
    { recipient: 'contractor', profile: contractor },
  ];

  for (const { recipient, profile } of recipients) {
    if (already.has(recipient)) continue;

    // Insert first (invoice_number comes from the DEFAULT sequence expression),
    // then render the PDF using the number we just got back, then attach the
    // storage path. If the insert hits the unique constraint (a concurrent
    // call already created it), skip silently rather than erroring.
    const storagePathPlaceholder = `pending/${booking.id}-${recipient}.pdf`;
    const { data: invoiceRow, error: insertErr } = await supabase
      .from('invoices')
      .insert({
        booking_id: booking.id,
        recipient,
        storage_path: storagePathPlaceholder,
        total_cents: recipient === 'customer' ? ledger.customerCharge.incGstCents : ledger.contractorPayout.incGstCents,
        gst_cents: recipient === 'customer' ? ledger.customerCharge.gstCents : ledger.contractorPayout.gstCents,
      })
      .select('id, invoice_number')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') continue; // already created by a concurrent caller
      console.error(`[invoices] insert failed for booking ${booking.id} (${recipient}):`, insertErr.message);
      continue;
    }

    try {
      const pdfBuffer = await renderInvoicePdf(recipient, booking, ledger, invoiceRow.invoice_number);
      const storagePath = `${booking.id}/${invoiceRow.invoice_number}.pdf`;

      const { error: uploadErr } = await supabase.storage.from('invoices').upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf', upsert: true,
      });
      if (uploadErr) throw uploadErr;

      await supabase.from('invoices').update({ storage_path: storagePath }).eq('id', invoiceRow.id);

      const email = profile?.email;
      await sendInvoiceEmail(email, recipient, booking, pdfBuffer, invoiceRow.invoice_number);
    } catch (err) {
      console.error(`[invoices] generation failed for booking ${booking.id} (${recipient}):`, err.message);
    }
  }
}

/**
 * Returns a signed URL for a party to download their invoice, for the
 * "Download invoice" button on the booking detail screens.
 */
async function getInvoiceDownloadUrl(bookingId, recipient, expiresInSeconds = 300) {
  const supabase = getSupabase();
  const { data: invoice } = await supabase.from('invoices').select('storage_path')
    .eq('booking_id', bookingId).eq('recipient', recipient).single();
  if (!invoice) return null;

  const { data, error } = await supabase.storage.from('invoices').createSignedUrl(invoice.storage_path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

module.exports = { generateInvoicesForBooking, getInvoiceDownloadUrl, renderInvoicePdf };
