import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'SK Requests <no-reply@example.com>';

async function send(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    // Notifications should never block the underlying workflow action.
    console.error('[email] send failed:', err.message);
  }
}

function wrap(bodyHtml) {
  return `
    <div style="font-family: sans-serif; color: #1e2a22; max-width: 480px; margin: 0 auto;">
      <p style="color:#5c6a61; font-size: 13px; margin-bottom: 24px;">Barangay Talamban SK — Document Requests</p>
      ${bodyHtml}
    </div>
  `;
}

export function sendVerificationEmail(to, verifyUrl) {
  return send(
    to,
    'Verify your email',
    wrap(`
      <h2>Verify your email</h2>
      <p>Click the link below to verify your email and link any past requests you made as a guest.</p>
      <p><a href="${verifyUrl}">Verify email</a></p>
      <p style="color:#5c6a61; font-size: 13px;">This link expires in 24 hours.</p>
    `)
  );
}

export function sendStatusEmail(to, { documentType, status, rejectionReason, statusUrl }) {
  const docLabel = documentType.replace(/_/g, ' ');
  const messages = {
    approved: `Your ${docLabel} request has been approved.`,
    rejected: `Your ${docLabel} request was rejected. Reason: ${rejectionReason}`,
    for_payment: `Your ${docLabel} request was approved. A fee is due before it can be processed.`,
    payment_rejected: `Your receipt for ${docLabel} could not be verified. Reason: ${rejectionReason}`,
    paid: `Your payment for ${docLabel} was verified.`,
  };

  return send(
    to,
    `Update on your ${docLabel} request`,
    wrap(`
      <h2>Request update</h2>
      <p>${messages[status] || `Your request status changed to ${status}.`}</p>
      <p><a href="${statusUrl}">View your request</a></p>
    `)
  );
}

export function sendReadyForClaimEmail(to, { documentType, claimCode, statusUrl }) {
  const docLabel = documentType.replace(/_/g, ' ');
  return send(
    to,
    `Your ${docLabel} is ready to claim`,
    wrap(`
      <h2>Ready for claim</h2>
      <p>Your ${docLabel} is ready. Present this code at the barangay hall:</p>
      <p style="font-family: monospace; font-size: 24px; letter-spacing: 2px;">${claimCode}</p>
      <p><a href="${statusUrl}">View your claim code and QR</a></p>
    `)
  );
}