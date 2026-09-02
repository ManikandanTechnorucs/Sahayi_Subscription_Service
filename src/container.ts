import { prisma } from '../libs/db/src/prisma';
import { RazorpayClient } from './clients/razorpay.client';
import { UserEntitlementClient } from './clients/user-entitlement.client';
import { RazorpayWebhookController } from './controllers/razorpay-webhook.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { UserSubscriptionController } from './controllers/user-subscription.controller';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { UserSubscriptionRepository } from './repositories/user-subscription.repository';
import { WebhookEventRepository } from './repositories/webhook-event.repository';
import { RazorpayWebhookService } from './services/razorpay-webhook.service';
import { SubscriptionService } from './services/subscription.service';
import { UserSubscriptionService } from './services/user-subscription.service';

const razorpayClient = new RazorpayClient();
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(subscriptionRepository, razorpayClient);

const userSubscriptionRepository = new UserSubscriptionRepository(prisma);
const webhookEventRepository = new WebhookEventRepository(prisma);
const userEntitlementClient = new UserEntitlementClient();
const userSubscriptionService = new UserSubscriptionService(
  userSubscriptionRepository,
  razorpayClient,
  userEntitlementClient,
);
const razorpayWebhookService = new RazorpayWebhookService(
  razorpayClient,
  webhookEventRepository,
  userSubscriptionRepository,
  userSubscriptionService,
);

/**
 * Composition root for subscription-service dependencies.
 */
export const container = {
  subscriptionController: new SubscriptionController(subscriptionService),
  userSubscriptionController: new UserSubscriptionController(userSubscriptionService),
  razorpayWebhookController: new RazorpayWebhookController(razorpayWebhookService),
};
