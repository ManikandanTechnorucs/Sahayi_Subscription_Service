import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import type { RazorpayClient } from '../clients/razorpay.client';
import type { SubscriptionService } from '../services/subscription.service';
import type { SyncRazorpayPlansResult } from '../types/subscription.types';

export type RazorpayCatalogSyncOptions = {
  force?: boolean;
};

/**
 * Migrates subscriptionmaster catalog rows onto the Razorpay dashboard for the
 * current RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (UAT test vs prod live).
 */
export async function runRazorpayCatalogSync(
  subscriptionService: SubscriptionService,
  razorpayClient: RazorpayClient,
  options: RazorpayCatalogSyncOptions = {},
): Promise<SyncRazorpayPlansResult | null> {
  if (!razorpayClient.isConfigured()) {
    logger.warn(
      { service: 'subscription-service' },
      'razorpay catalog sync skipped: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set',
    );
    return null;
  }

  const force = options.force === true || config.RAZORPAY_SYNC_FORCE;
  const dashboard = razorpayClient.getDashboardMode();

  logger.info(
    {
      service: 'subscription-service',
      dashboard,
      force,
    },
    'starting razorpay catalog sync for this environment',
  );

  const result = await subscriptionService.syncRazorpayPlans({ force });

  logger.info(
    {
      service: 'subscription-service',
      dashboard,
      count: result.count,
      results: result.results.map((item) => ({
        planId: item.plan.id,
        name: item.plan.name,
        monthly: item.monthly,
        yearly: item.yearly,
      })),
    },
    'razorpay catalog sync completed',
  );

  return result;
}
