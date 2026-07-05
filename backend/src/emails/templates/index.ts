function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-top: 0; }
    p { color: #4a4a4a; line-height: 1.6; }
    .highlight { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
    <div class="footer">
      <p>This is an automated email from Subscription Billing Platform.</p>
    </div>
  </div>
</body>
</html>`;
}

export function paymentConfirmationTemplate(
  planName: string,
  formattedAmount: string,
  periodEnd: Date
): string {
  return baseTemplate(
    'Payment Confirmed',
    `
    <h1>Payment Confirmed ✓</h1>
    <p>Your payment has been successfully processed.</p>
    <div class="highlight">
      <p><strong>Plan:</strong> ${planName}</p>
      <p><strong>Amount:</strong> ${formattedAmount}</p>
      <p><strong>Valid until:</strong> ${formatDate(periodEnd)}</p>
    </div>
    <p>Your subscription is now active. You can manage your subscription from your dashboard.</p>
    `
  );
}

export function paymentFailedTemplate(
  planName: string,
  formattedAmount: string
): string {
  return baseTemplate(
    'Payment Failed',
    `
    <h1>Payment Failed ✗</h1>
    <p>We were unable to process your payment.</p>
    <div class="highlight">
      <p><strong>Plan:</strong> ${planName}</p>
      <p><strong>Amount:</strong> ${formattedAmount}</p>
    </div>
    <p>Please try again or use a different payment method. Your subscription has not been activated.</p>
    `
  );
}

export function invoiceEmailTemplate(
  description: string,
  formattedAmount: string,
  issuedAt: Date
): string {
  return baseTemplate(
    'Invoice',
    `
    <h1>Invoice</h1>
    <div class="highlight">
      <p><strong>Description:</strong> ${description}</p>
      <p><strong>Amount:</strong> ${formattedAmount}</p>
      <p><strong>Date:</strong> ${formatDate(issuedAt)}</p>
    </div>
    <p>This invoice is for your records. No action is required.</p>
    `
  );
}

export function cancellationConfirmationTemplate(
  planName: string,
  periodEnd: Date
): string {
  return baseTemplate(
    'Subscription Cancellation',
    `
    <h1>Subscription Cancelled</h1>
    <p>Your cancellation request has been processed.</p>
    <div class="highlight">
      <p><strong>Plan:</strong> ${planName}</p>
      <p><strong>Access until:</strong> ${formatDate(periodEnd)}</p>
    </div>
    <p>You will continue to have full access until ${formatDate(periodEnd)}. After that, your subscription will expire.</p>
    `
  );
}

export function planUpgradedTemplate(
  oldPlanName: string,
  newPlanName: string,
  formattedProratedAmount: string
): string {
  return baseTemplate(
    'Plan Upgraded',
    `
    <h1>Plan Upgraded ↑</h1>
    <p>Your plan has been successfully upgraded.</p>
    <div class="highlight">
      <p><strong>Previous plan:</strong> ${oldPlanName}</p>
      <p><strong>New plan:</strong> ${newPlanName}</p>
      <p><strong>Prorated charge:</strong> ${formattedProratedAmount}</p>
    </div>
    <p>You now have access to all features of the ${newPlanName} plan. The prorated charge covers the remainder of your current billing cycle.</p>
    `
  );
}

export function downgradeScheduledTemplate(
  currentPlanName: string,
  newPlanName: string,
  effectiveDate: Date
): string {
  return baseTemplate(
    'Plan Change Scheduled',
    `
    <h1>Plan Change Scheduled</h1>
    <p>Your plan change has been scheduled.</p>
    <div class="highlight">
      <p><strong>Current plan:</strong> ${currentPlanName}</p>
      <p><strong>New plan:</strong> ${newPlanName}</p>
      <p><strong>Effective date:</strong> ${formatDate(effectiveDate)}</p>
    </div>
    <p>You will continue to have full access to ${currentPlanName} features until ${formatDate(effectiveDate)}. After that, your plan will automatically switch to ${newPlanName}.</p>
    `
  );
}