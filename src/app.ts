import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middlewares/error-handler';
import { requestLogger } from './middlewares/request-logger';
import razorpayWebhookRoutes from './routes/razorpay-webhook.routes';
import internalRoutes from './routes/internal.routes';
import subscriptionRoutes from './routes/subscription.routes';
import userSubscriptionRoutes from './routes/user-subscription.routes';
import { registerSwagger } from './swagger';

const app = express();

app.set('trust proxy', 1);

registerSwagger(app);

// APIs may be served over plain HTTP behind a TLS terminator. Helmet defaults
// send HSTS and CSP upgrade-insecure-requests, which makes iOS force HTTPS
// and blank Swagger UI. Keep this aligned with User Service.
app.use(helmet({ hsts: false, contentSecurityPolicy: false }));
app.use(cors({ origin: '*', allowedHeaders: '*', methods: '*' }));
app.use(requestLogger);

// Accept any content type as a buffer. Razorpay HMAC is over the raw body, and a
// missed application/json match would empty the body and 401 every delivery.
app.use('/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }), razorpayWebhookRoutes);

app.use(express.json());

app.use('/subscriptions', subscriptionRoutes);
app.use('/me/subscriptions', userSubscriptionRoutes);
app.use('/internal', internalRoutes);

app.use(errorHandler);

export default app;
