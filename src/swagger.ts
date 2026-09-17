import type { Express, Request } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from '../libs/config/src/config';
import { subscriptionServiceOpenApiDocument } from './openapi/subscription-service.openapi';

const localUrl = `http://localhost:${config.SUBSCRIPTION_SERVICE_PORT}`;

const serversForRequest = (req: Request) => {
  const host = req.get('host');
  const currentUrl = host ? `${req.protocol}://${host}` : localUrl;
  const unique = new Map<string, string>([
    [currentUrl, 'Current environment'],
    [config.SUBSCRIPTION_SERVICE_PUBLIC_URL, 'Production'],
    [localUrl, 'Local development'],
  ]);

  return [...unique.entries()].map(([url, description]) => ({ url, description }));
};

/**
 * Mounts Swagger UI and the raw OpenAPI JSON document.
 */
export const registerSwagger = (app: Express): void => {
  app.get('/api-docs/openapi.json', (req, res) => {
    res.json({
      ...subscriptionServiceOpenApiDocument,
      servers: serversForRequest(req),
    });
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(subscriptionServiceOpenApiDocument, {
      swaggerOptions: {
        url: '/api-docs/openapi.json',
      },
      customSiteTitle: 'Sahayi Subscription Service API',
    }),
  );
};
