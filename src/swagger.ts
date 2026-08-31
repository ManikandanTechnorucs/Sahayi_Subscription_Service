import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from '../libs/config/src/config';
import { subscriptionServiceOpenApiDocument } from './openapi/subscription-service.openapi';

const openApiDocument = {
  ...subscriptionServiceOpenApiDocument,
  servers: [
    {
      url: `http://localhost:${config.SUBSCRIPTION_SERVICE_PORT}`,
      description: 'Current environment',
    },
  ],
};

/**
 * Mounts Swagger UI and the raw OpenAPI JSON document.
 */
export const registerSwagger = (app: Express): void => {
  app.get('/api-docs/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Sahayi Subscription Service API',
    }),
  );
};
