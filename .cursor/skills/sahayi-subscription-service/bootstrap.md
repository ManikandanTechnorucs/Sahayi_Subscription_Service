# Bootstrap Subscription Service from User Service

Use this when `Sahayi_SubscriptionService/src` does not exist yet. Copy files from `Sahayi_User_Service`; then strip user-domain code.

## Copy

| From User Service | Action |
|---|---|
| `package.json` | Rename package; `start` → `src/server.ts`; drop `@azure/storage-blob`, `multer`, `twilio` until needed |
| `tsconfig.json` | Copy as-is |
| `prisma.config.ts` | Copy; same `DATABASE_URL` if sharing MySQL |
| `Dockerfile` | Expose `SUBSCRIPTION_SERVICE_PORT` (default **3007**; User=3005, Notification=3004, Request=3006) |
| `.gitignore`, `.dockerignore`, `.npmrc` | Copy |
| `libs/config`, `db`, `logger`, `auth`, `validation`, `response` | Copy; change `USER_SERVICE_PORT` → `SUBSCRIPTION_SERVICE_PORT`; logger default service name |
| `src/errors`, `src/middlewares/auth.middleware.ts`, `request-logger.ts`, `error-handler.ts` | Copy; request-logger `service: 'subscription-service'` |
| `prisma/schema.prisma` | Start with generator/datasource + `subscriptionmaster` (and enums it needs). Do not copy unrelated user models unless this service must query them. |

## Create

- `src/app.ts` — helmet, cors, json, requestLogger, swagger (dev), `app.use('/subscriptions', ...)`, `errorHandler` last
- `src/server.ts` — `app.listen(config.SUBSCRIPTION_SERVICE_PORT)`
- `src/container.ts` — empty composition root, then wire first domain
- `src/swagger.ts` + `src/openapi/subscription-service.openapi.ts`
- First slice: types, validator, repository, service, controller, routes for plans

## Env

```
DATABASE_URL=
JWT_SECRET=
SUBSCRIPTION_SERVICE_PORT=3007
NODE_ENV=development
```

`npx prisma generate` after schema exists. Do not commit `.env` or `generated/`.
