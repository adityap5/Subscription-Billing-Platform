import { Resend } from 'resend';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';
import { formatPaise } from '../utils/money';
import {
  paymentConfirmationTemplate,
  paymentFailedTemplate,
  invoiceEmailTemplate,
  cancellationConfirmationTemplate,
  planUpgradedTemplate,
  downgradeScheduledTemplate,
} from '../emails/templates';

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const { RESEND_API_KEY } = getEnv();
    resendInstance = new Resend(RESEND_API_KEY);
  }
  return resendInstance;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  try {
    const { RESEND_FROM_EMAIL } = getEnv();
    const resend = getResend();

    const { error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    if (error) {
      logger.error('Email send failed (Resend error)', {
        to,
        subject,
        error: error.message,
      });
      return;
    }

    logger.info('Email sent successfully', { to, subject });
  } catch (error) {
    // Edge Case #14: Never throw from email — log and continue
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Email send failed (exception)', {
      to,
      subject,
      error: message,
    });
  }
}

export async function sendPaymentConfirmation(
  to: string,
  planName: string,
  amountInPaise: number,
  periodEnd: Date
): Promise<void> {
  await sendEmail(
    to,
    `Payment Confirmed — ${planName} Subscription`,
    paymentConfirmationTemplate(planName, formatPaise(amountInPaise), periodEnd)
  );
}

export async function sendPaymentFailed(
  to: string,
  planName: string,
  amountInPaise: number
): Promise<void> {
  await sendEmail(
    to,
    `Payment Failed — ${planName} Subscription`,
    paymentFailedTemplate(planName, formatPaise(amountInPaise))
  );
}

export async function sendInvoiceEmail(
  to: string,
  invoiceDescription: string,
  amountInPaise: number,
  issuedAt: Date
): Promise<void> {
  await sendEmail(
    to,
    `Invoice — ${invoiceDescription}`,
    invoiceEmailTemplate(invoiceDescription, formatPaise(amountInPaise), issuedAt)
  );
}

export async function sendCancellationConfirmation(
  to: string,
  planName: string,
  periodEnd: Date
): Promise<void> {
  await sendEmail(
    to,
    `Subscription Cancellation Confirmed`,
    cancellationConfirmationTemplate(planName, periodEnd)
  );
}

export async function sendPlanUpgraded(
  to: string,
  oldPlanName: string,
  newPlanName: string,
  proratedAmountInPaise: number
): Promise<void> {
  await sendEmail(
    to,
    `Plan Upgraded to ${newPlanName}`,
    planUpgradedTemplate(oldPlanName, newPlanName, formatPaise(proratedAmountInPaise))
  );
}

export async function sendDowngradeScheduled(
  to: string,
  currentPlanName: string,
  newPlanName: string,
  effectiveDate: Date
): Promise<void> {
  await sendEmail(
    to,
    `Plan Change Scheduled — ${newPlanName}`,
    downgradeScheduledTemplate(currentPlanName, newPlanName, effectiveDate)
  );
}