import { prisma } from '../../libs/db/src/prisma';
import { logger } from '../../libs/logger/src/logger';
import { container } from '../container';
import { runRazorpayCatalogSync } from '../jobs/razorpay-catalog-sync.job';

const force = process.argv.includes('--force');

const run = async (): Promise<void> => {
  try {
    const result = await runRazorpayCatalogSync(
      container.subscriptionService,
      container.razorpayClient,
      { force },
    );

    if (!result) {
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    logger.error(
      {
        service: 'subscription-service',
        err: error instanceof Error ? error.message : 'unknown error',
      },
      'razorpay catalog sync failed',
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void run();
