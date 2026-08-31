# Layer contracts

Copy `Sahayi_User_Service`. This service is a vertical slice per domain, composed in `src/container.ts`.

## Runtime

```
src/server.ts          listen(config.SUBSCRIPTION_SERVICE_PORT)
src/app.ts             helmet, cors, json, requestLogger, swagger (dev), routers, errorHandler
src/container.ts       new Repository(prisma) → new Service(...) → new Controller(service)
```

Log field `service` is always `'subscription-service'`.

## Folders

```
src/routes          HTTP verbs only
src/controllers     parse request, call service, envelope response
src/services        business rules; throw AppError; no req/res
src/repositories    Prisma only; map DB rows to camelCase DTOs
src/validators      Zod schemas for body/query/params/headers
src/types           API DTOs (never Prisma PascalCase)
src/middlewares     auth, request-logger, error-handler
src/clients         outbound HTTP to other Sahayi services (if needed)
src/openapi         OpenAPI 3.0 document (APIM source of truth)
src/errors          AppError hierarchy
src/container.ts    composition root (manual DI)
src/app.ts          middleware + route mount; no listen()
src/server.ts       listen only
libs/               config, db, logger, auth, validation, response
prisma/schema.prisma
generated/prisma    generated client — never edit
```

Copy these `libs/` from User Service (drop Azure Blob / Twilio / multer unless this service needs them): `config`, `db`, `logger`, `auth`, `validation`, `response`.

## Auth

Copy `src/middlewares/auth.middleware.ts` and `libs/auth/src/jwt.ts`. JWT payload: `{ id, role, purpose? }`. Authenticated handlers use `asAuthenticatedHandler`. Plan catalog may stay authenticated like User Service `GET /subscriptions`.

## Errors

Copy `src/errors/app-error.ts` and `error-handler.ts`. Map Prisma `P2002` → 409, `P2025` → 404. Throw `AppError` subclasses from **services**.

## IDs and mapping

HTTP/DTOs use camelCase. Prisma keeps existing DB names (`Id`, `Name`, `MonthlyCost`, `yearlyCost`, `IsActive`). Repositories translate. `subscriptionmaster.Id` is `Int` in User Service (not BigInt).

## Cross-service calls

If User Service must stay the source of `users.SubscriptionId`, add `src/clients/` HTTP — do not query the `users` table from this service unless product explicitly shares that schema.
