import { Invoice, IInvoice } from '../models/invoice.model';
import { logger } from '../utils/logger';

export async function createInvoice(
  userId: string,
  subscriptionId: string,
  paymentId: string,
  amountInPaise: number,
  description: string
): Promise<IInvoice> {
  const invoice = await Invoice.create({
    userId,
    subscriptionId,
    paymentId,
    amountInPaise,
    issuedAt: new Date(),
    description,
  });

  logger.info('Invoice created', {
    invoiceId: invoice._id.toString(),
    userId,
    amountInPaise,
    description,
  });

  return invoice;
}

export async function getUserInvoices(userId: string): Promise<IInvoice[]> {
  return Invoice.find({ userId })
    .sort({ issuedAt: -1 })
    .lean();
}

export async function getSubscriptionInvoices(
  subscriptionId: string
): Promise<IInvoice[]> {
  return Invoice.find({ subscriptionId })
    .sort({ issuedAt: -1 })
    .lean();
}