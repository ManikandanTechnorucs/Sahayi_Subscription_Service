import dns from 'node:dns';
import app from './app';
import { config } from '../libs/config/src/config';
import { logger } from '../libs/logger/src/logger';
import { container } from './container';
import { runRazorpayCatalogSync } from './jobs/razorpay-catalog-sync.job';

dns.setDefaultResultOrder('ipv4first');

app.listen(config.SUBSCRIPTION_SERVICE_PORT, '0.0.0.0', () => {
  logger.info(
    {
      port: config.SUBSCRIPTION_SERVICE_PORT,
      host: '0.0.0.0',
      service: 'subscription-service',
      userServiceBaseUrl: config.USER_SERVICE_BASE_URL,
    },
    'subscription service started',
  );

  if (!config.RAZORPAY_SYNC_ON_STARTUP) {
    return;
  }

  void runRazorpayCatalogSync(container.subscriptionService, container.razorpayClient).catch(
    (error: unknown) => {
      logger.error(
        {
          service: 'subscription-service',
          err: error instanceof Error ? error.message : 'unknown error',
        },
        'razorpay catalog sync on startup failed',
      );
    },
  );
});
