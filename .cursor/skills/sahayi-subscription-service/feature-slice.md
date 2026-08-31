# Feature slice templates

Copy `Sahayi_User_Service` domains. Prefer `master.*` for listing plans and `family-member.*` for authenticated CRUD.

## File set

```
src/types/{domain}.types.ts
src/validators/{domain}.validator.ts
src/repositories/{domain}.repository.ts
src/services/{domain}.service.ts
src/controllers/{domain}.controller.ts
src/routes/{domain}.routes.ts
src/container.ts
src/app.ts
src/openapi/subscription-service.openapi.ts
prisma/schema.prisma            # only if DB changes
```

First domain to add: `subscription` (plan catalog). Suggested mounts: `/subscriptions` (list/get/create/update), authenticated `/me` for the caller's current plan if this service owns assignment.

## Validator sketch

```ts
import { z } from 'zod';

const bearerAuthHeadersSchema = z.looseObject({
  authorization: z.string().regex(/^Bearer\s+\S+$/),
});

export const listSubscriptionsSchema = { headers: bearerAuthHeadersSchema };

export const createSubscriptionSchema = {
  headers: bearerAuthHeadersSchema,
  body: z
    .object({
      name: z.string().min(1).max(100),
      label: z.string().min(1).max(100),
      monthlyCost: z.string().max(10),
      yearlyCost: z.string().max(10),
    })
    .strict(),
};
```

Align `.max(n)` with Prisma `@db.VarChar(n)` on `subscriptionmaster`.

## Route sketch

```ts
router.get(
  '/',
  authMiddleware,
  requireAccessToken,
  validate(listSubscriptionsSchema),
  asAuthenticatedHandler(container.subscriptionController.listSubscriptions),
);
```

Mount as `app.use('/subscriptions', subscriptionRoutes)`.

## Container sketch

```ts
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(subscriptionRepository);
export const container = {
  subscriptionController: new SubscriptionController(subscriptionService),
};
```

## Controller responses

| Outcome | Status + helper |
|---|---|
| List with rows | `200` `response.createJson(SUCCESS_CODE, rows, rows.length)` |
| Empty list | `200` `response.NO_DATA_FOUND` |
| Single get | `200` `response.createJson(SUCCESS_CODE, row)` |
| Create | `201` `{ ...response.DATA_SAVED, data }` |
| Update | `200` `{ ...response.DATA_UPDATED, data }` |
| Delete | `200` `response.DATA_DELETED_SUCCESSFULLY` |
