---
name: sahayi-subscription-service
description: >-
  Builds and changes Sahayi_SubscriptionService using the User Service layered
  architecture (Express routes, controllers, services, Prisma repositories, Zod,
  container DI, OpenAPI). Use when working in Sahayi_SubscriptionService, adding
  subscription endpoints or plans, bootstrapping this service, or when asked to
  follow User Service architecture for subscriptions.
---

# Sahayi Subscription Service

Develop **only** in `Sahayi_SubscriptionService/`. Canonical architecture to copy: sibling `Sahayi_User_Service/`. Do not add subscription features to User Service.

Read [architecture.md](architecture.md) for layer contracts. Read [feature-slice.md](feature-slice.md) when adding a domain. Read [bootstrap.md](bootstrap.md) if the service code does not exist yet.

## Before writing code

1. Copy structure from `Sahayi_User_Service` (`journal.*` for its own router, `family-member.*` for nested `/me` routes, `master.*` for plan listing).
2. Keep the same folders, naming, envelopes, and DI. Do not invent `src/models`, `src/config`, mysql2, awilix, or `/api/v1` prefixes.

## Request path (mandatory)

```
route middleware → controller → service → repository → Prisma
```

- Routes: `authMiddleware` → `requireAccessToken` → `validate(schema)` → `asAuthenticatedHandler(controller.method)`.
- Controllers: log `{ service: 'subscription-service', requestId, userId, method, path }`, call service, `libs/response`, `next(error)`. Bind methods in the constructor.
- Services: business rules + `AppError`. No Express, no Prisma.
- Repositories: Prisma + map to camelCase DTOs in `src/types`.
- Wire in `src/container.ts`. Mount in `src/app.ts`. Document in `src/openapi/subscription-service.openapi.ts`.

## Domain notes (today in User Service)

User Service currently lists plans at `GET /subscriptions` from Prisma `subscriptionmaster`, and stores `users.SubscriptionId`. This service should own plan catalog and subscription assignment APIs. Keep the same DTO field names as `Sahayi_User_Service/src/types/subscription.types.ts` unless a breaking change is requested.

## Do not

- Call Prisma from controllers or services
- Return raw `{ success: true }` instead of `response.*`
- New-up repositories inside services
- Put domain rules in `libs/`
- Edit `generated/prisma`
- Implement this work under `Sahayi_User_Service/`

## Checklist before finishing

- [ ] Types, validator, repository, service, controller, routes
- [ ] `container.ts` + `app.ts` mount
- [ ] OpenAPI path + envelope schemas
- [ ] Prisma migrate/generate if schema changed
- [ ] Empty list → 200 `NO_DATA_FOUND`; create → 201 `DATA_SAVED`; update → `DATA_UPDATED`
