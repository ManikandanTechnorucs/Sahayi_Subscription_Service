import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from '../libs/config/src/config';
import { errorHandler } from './middlewares/error-handler';
import { requestLogger } from './middlewares/request-logger';
import razorpayWebhookRoutes from './routes/razorpay-webhook.routes';
import subscriptionRoutes from './routes/subscription.routes';
import userSubscriptionRoutes from './routes/user-subscription.routes';
import { registerSwagger } from './swagger';

const app = express();

app.use(
  helmet(
    config.IS_DEVELOPMENT
      ? {
          contentSecurityPolicy: false,
        }
      : {},
  ),
);
app.use(cors());

// Razorpay webhooks require the raw body for signature verification.
app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }), razorpayWebhookRoutes);

app.use(express.json());
app.use(requestLogger);

if (config.IS_DEVELOPMENT) {
  registerSwagger(app);
}

app.use('/subscriptions', subscriptionRoutes);
app.use('/me/subscriptions', userSubscriptionRoutes);

app.use(errorHandler);

export default app;
