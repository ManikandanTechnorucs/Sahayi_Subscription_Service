import app from './app';
import { config } from '../libs/config/src/config';
import { logger } from '../libs/logger/src/logger';

app.listen(config.SUBSCRIPTION_SERVICE_PORT, '0.0.0.0',() => {
  logger.info(
    {
      port: config.SUBSCRIPTION_SERVICE_PORT,
      host: '0.0.0.0',
      service: 'subscription-service',
    },
    'subscription service started',
  );
});
