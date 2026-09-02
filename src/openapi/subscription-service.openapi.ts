/**
 * OpenAPI 3.0 document for subscription-service endpoints.
 * Used by Swagger UI and as the APIM import source of truth.
 */
export const subscriptionServiceOpenApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Sahayi Subscription Service API',
    version: '1.0.0',
    description:
      'Plan catalog and Razorpay recurring subscription APIs for the Sahayi platform. Mobile clients consume JSON envelopes under /subscriptions and /me/subscriptions.',
  },
  servers: [
    {
      url: 'http://localhost:3007',
      description: 'Local development',
    },
  ],
  tags: [
    {
      name: 'Subscriptions',
      description: 'Authenticated subscription plan catalog operations',
    },
    {
      name: 'My Subscriptions',
      description: 'Authenticated user subscription lifecycle (Razorpay)',
    },
    {
      name: 'Webhooks',
      description: 'Provider webhook ingestion (no JWT)',
    },
  ],
  paths: {
    '/subscriptions': {
      get: {
        tags: ['Subscriptions'],
        summary: 'List active subscriptions',
        description: 'Returns subscription master records where IsActive is true.',
        operationId: 'listSubscriptions',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Subscriptions retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionListResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Subscriptions'],
        summary: 'Create a subscription plan',
        description:
          'Creates a subscription master record. When syncRazorpay is true (default), paid monthly/yearly costs also create Razorpay Plans and store the returned plan ids. Cost 0 (Free) is not synced to Razorpay.',
        operationId: 'createSubscription',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSubscriptionRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Subscription created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionSavedResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Duplicate subscription name or label',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/subscriptions/sync-razorpay': {
      post: {
        tags: ['Subscriptions'],
        summary: 'Sync Razorpay plans for catalog records',
        description:
          'Creates missing Razorpay monthly/yearly plans for active catalog records, or for the given ids. Free (0 cost) cycles are skipped. Existing Razorpay plan ids are left unchanged unless force is true. Razorpay plan amounts cannot be updated in place.',
        operationId: 'syncRazorpayPlans',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SyncRazorpayPlansRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Razorpay plans synced',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SyncRazorpayPlansResponse' },
              },
            },
          },
          '400': {
            description: 'Validation or Razorpay error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'One or more catalog ids were not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '503': {
            description: 'Razorpay is not configured',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/subscriptions/{id}/sync-razorpay': {
      post: {
        tags: ['Subscriptions'],
        summary: 'Sync Razorpay plans for one catalog record',
        description:
          'Creates missing Razorpay monthly/yearly plans for the catalog record and persists the ids.',
        operationId: 'syncRazorpayPlan',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Subscription catalog identifier',
            schema: {
              type: 'string',
              pattern: '^\\d+$',
              example: '2',
            },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SyncRazorpayPlanRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Razorpay plans synced',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SyncRazorpayPlanResponse' },
              },
            },
          },
          '400': {
            description: 'Validation or Razorpay error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Subscription not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '503': {
            description: 'Razorpay is not configured',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/subscriptions/{id}': {
      get: {
        tags: ['Subscriptions'],
        summary: 'Get a subscription plan',
        description: 'Returns a subscription master record by id.',
        operationId: 'getSubscription',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Subscription identifier',
            schema: {
              type: 'string',
              pattern: '^\\d+$',
              example: '1',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Subscription retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Subscription not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Subscriptions'],
        summary: 'Update a subscription plan',
        description: 'Updates one or more fields on a subscription master record.',
        operationId: 'updateSubscription',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Subscription identifier',
            schema: {
              type: 'string',
              pattern: '^\\d+$',
              example: '1',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateSubscriptionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Subscription updated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionUpdatedResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Subscription not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Duplicate subscription name or label',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Unexpected server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/me/subscriptions': {
      post: {
        tags: ['My Subscriptions'],
        summary: 'Create Razorpay subscription and checkout params',
        description:
          'Creates a Razorpay subscription for a paid plan and returns native Checkout parameters. Reuses an unfinished checkout for the same plan, or creates a replacement checkout when changing plans. Free plans skip Razorpay and update entitlements immediately. Does not activate a paid plan until checkout is verified.',
        operationId: 'createUserSubscription',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserSubscriptionRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Subscription created; checkout params returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateCheckoutResponseEnvelope' },
              },
            },
          },
          '400': {
            description: 'Validation or Razorpay plan mapping error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'User already has this paid subscription',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/me/subscriptions/verify': {
      post: {
        tags: ['My Subscriptions'],
        summary: 'Verify checkout payment signature',
        description:
          'Server-side verification of Razorpay checkout response. Marks checkout verified, cancels the previous paid subscription if one exists, and updates user entitlements.',
        operationId: 'verifyUserSubscriptionCheckout',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VerifyUserSubscriptionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Signature verified',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserSubscriptionResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid signature or validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Subscription does not belong to user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Subscription not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/me/subscriptions/current': {
      get: {
        tags: ['My Subscriptions'],
        summary: 'Get current user subscription',
        operationId: 'getCurrentUserSubscription',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current subscription or NO_DATA_FOUND',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserSubscriptionResponse' },
              },
            },
          },
          '401': {
            description: 'Missing or invalid access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/me/subscriptions/{id}': {
      get: {
        tags: ['My Subscriptions'],
        summary: 'Get user subscription by id',
        operationId: 'getUserSubscriptionById',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^\\d+$' },
          },
        ],
        responses: {
          '200': {
            description: 'Subscription retrieved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserSubscriptionResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/me/subscriptions/{id}/cancel': {
      post: {
        tags: ['My Subscriptions'],
        summary: 'Cancel user subscription',
        operationId: 'cancelUserSubscription',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^\\d+$' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CancelUserSubscriptionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Subscription cancel requested/updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserSubscriptionUpdatedResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/me/subscriptions/{id}/pause': {
      post: {
        tags: ['My Subscriptions'],
        summary: 'Pause user subscription',
        operationId: 'pauseUserSubscription',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^\\d+$' },
          },
        ],
        responses: {
          '200': {
            description: 'Subscription paused',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserSubscriptionUpdatedResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/me/subscriptions/{id}/resume': {
      post: {
        tags: ['My Subscriptions'],
        summary: 'Resume user subscription',
        operationId: 'resumeUserSubscription',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^\\d+$' },
          },
        ],
        responses: {
          '200': {
            description: 'Subscription resumed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserSubscriptionUpdatedResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/webhooks/razorpay': {
      post: {
        tags: ['Webhooks'],
        summary: 'Razorpay subscription webhooks',
        description:
          'Receives Razorpay events. Requires X-Razorpay-Signature over raw body and X-Razorpay-Event-Id for idempotency. No JWT.',
        operationId: 'razorpayWebhook',
        security: [],
        responses: {
          '200': {
            description: 'Event accepted (including duplicates)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WebhookAckResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid or missing signature',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token issued by the auth service',
      },
    },
    schemas: {
      SubscriptionPlan: {
        type: 'object',
        required: [
          'id',
          'name',
          'label',
          'monthlyCost',
          'yearlyCost',
          'familyMembersLimit',
          'emergencyContactsLimit',
          'caregiverConnection',
          'caretakerConnection',
          'remindersLimit',
          'emergencySOSalert',
          'wearableIntegration',
          'advancedReminderTracking',
          'advancedHealthMonitor',
          'advancedAINotification',
        ],
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'BASIC' },
          label: { type: 'string', example: 'Basic Plan' },
          monthlyCost: { type: 'string', example: '99' },
          yearlyCost: { type: 'string', example: '999' },
          familyMembersLimit: { type: 'integer', example: 3 },
          emergencyContactsLimit: { type: 'integer', example: 2 },
          caregiverConnection: { type: 'integer', example: 1 },
          caretakerConnection: { type: 'integer', example: 1 },
          remindersLimit: { type: 'string', example: '10' },
          emergencySOSalert: { type: 'boolean', example: true },
          wearableIntegration: { type: 'boolean', example: false },
          advancedReminderTracking: { type: 'boolean', example: false },
          advancedHealthMonitor: { type: 'boolean', example: false },
          advancedAINotification: { type: 'boolean', example: false },
          aiTextLimit: { type: 'string', nullable: true, example: '100' },
          aiVoiceLimit: { type: 'string', nullable: true, example: '50' },
          razorpayPlanIdMonthly: {
            type: 'string',
            nullable: true,
            example: 'plan_monthly_xxx',
          },
          razorpayPlanIdYearly: {
            type: 'string',
            nullable: true,
            example: 'plan_yearly_xxx',
          },
        },
      },
      SubscriptionListResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'data', 'count'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { oneOf: [{ type: 'integer' }, { type: 'string' }], example: 200 },
          message: { type: 'string', example: 'Success' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/SubscriptionPlan' },
          },
          count: { type: 'integer', example: 2 },
        },
      },
      SubscriptionResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { oneOf: [{ type: 'integer' }, { type: 'string' }], example: 200 },
          message: { type: 'string', example: 'Success' },
          data: { $ref: '#/components/schemas/SubscriptionPlan' },
        },
      },
      CreateSubscriptionRequest: {
        type: 'object',
        required: [
          'name',
          'label',
          'monthlyCost',
          'yearlyCost',
          'familyMembersLimit',
          'emergencyContactsLimit',
          'caregiverConnection',
          'caretakerConnection',
          'remindersLimit',
          'emergencySOSalert',
          'wearableIntegration',
          'advancedReminderTracking',
          'advancedHealthMonitor',
          'advancedAINotification',
        ],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100, example: 'BASIC' },
          label: { type: 'string', minLength: 1, maxLength: 100, example: 'Basic Plan' },
          monthlyCost: { type: 'string', minLength: 1, maxLength: 10, example: '99' },
          yearlyCost: { type: 'string', minLength: 1, maxLength: 10, example: '999' },
          familyMembersLimit: { type: 'integer', minimum: 0, example: 3 },
          emergencyContactsLimit: { type: 'integer', minimum: 0, example: 2 },
          caregiverConnection: { type: 'integer', minimum: 0, example: 1 },
          caretakerConnection: { type: 'integer', minimum: 0, example: 1 },
          remindersLimit: { type: 'string', minLength: 1, maxLength: 10, example: '10' },
          emergencySOSalert: { type: 'boolean', example: true },
          wearableIntegration: { type: 'boolean', example: false },
          advancedReminderTracking: { type: 'boolean', example: false },
          advancedHealthMonitor: { type: 'boolean', example: false },
          advancedAINotification: { type: 'boolean', example: false },
          aiTextLimit: { type: 'string', maxLength: 50, nullable: true, example: '100' },
          aiVoiceLimit: { type: 'string', maxLength: 50, nullable: true, example: '50' },
          razorpayPlanIdMonthly: { type: 'string', maxLength: 40, nullable: true },
          razorpayPlanIdYearly: { type: 'string', maxLength: 40, nullable: true },
          isActive: { type: 'boolean', example: true },
          syncRazorpay: {
            type: 'boolean',
            default: true,
            description:
              'Create Razorpay monthly/yearly plans for paid costs and persist plan ids. Ignored for 0-cost cycles.',
          },
        },
      },
      UpdateSubscriptionRequest: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          label: { type: 'string', minLength: 1, maxLength: 100 },
          monthlyCost: { type: 'string', minLength: 1, maxLength: 10 },
          yearlyCost: { type: 'string', minLength: 1, maxLength: 10 },
          familyMembersLimit: { type: 'integer', minimum: 0 },
          emergencyContactsLimit: { type: 'integer', minimum: 0 },
          caregiverConnection: { type: 'integer', minimum: 0 },
          caretakerConnection: { type: 'integer', minimum: 0 },
          remindersLimit: { type: 'string', minLength: 1, maxLength: 10 },
          emergencySOSalert: { type: 'boolean' },
          wearableIntegration: { type: 'boolean' },
          advancedReminderTracking: { type: 'boolean' },
          advancedHealthMonitor: { type: 'boolean' },
          advancedAINotification: { type: 'boolean' },
          aiTextLimit: { type: 'string', maxLength: 50, nullable: true },
          aiVoiceLimit: { type: 'string', maxLength: 50, nullable: true },
          razorpayPlanIdMonthly: { type: 'string', maxLength: 40, nullable: true },
          razorpayPlanIdYearly: { type: 'string', maxLength: 40, nullable: true },
          isActive: { type: 'boolean' },
        },
      },
      SyncRazorpayPlansRequest: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ids: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'integer', minimum: 1 },
            description: 'Catalog ids to sync. Omit to sync all active plans.',
          },
          force: {
            type: 'boolean',
            default: false,
            description:
              'When true, create new Razorpay plans even if ids already exist. Razorpay amounts are immutable; use this only when you intend to replace the mapped plan ids.',
          },
        },
      },
      SyncRazorpayPlanRequest: {
        type: 'object',
        additionalProperties: false,
        properties: {
          force: { type: 'boolean', default: false },
        },
      },
      RazorpayPlanSyncCycleResult: {
        type: 'object',
        required: ['action', 'razorpayPlanId'],
        properties: {
          action: { type: 'string', enum: ['created', 'existing', 'skipped'] },
          razorpayPlanId: { type: 'string', nullable: true, example: 'plan_xxxxx' },
          reason: { type: 'string', example: 'Free plans are not synced to Razorpay' },
        },
      },
      SyncRazorpayPlanResult: {
        type: 'object',
        required: ['plan', 'monthly', 'yearly'],
        properties: {
          plan: { $ref: '#/components/schemas/SubscriptionPlan' },
          monthly: { $ref: '#/components/schemas/RazorpayPlanSyncCycleResult' },
          yearly: { $ref: '#/components/schemas/RazorpayPlanSyncCycleResult' },
        },
      },
      SyncRazorpayPlansResult: {
        type: 'object',
        required: ['count', 'results'],
        properties: {
          count: { type: 'integer', example: 2 },
          results: {
            type: 'array',
            items: { $ref: '#/components/schemas/SyncRazorpayPlanResult' },
          },
        },
      },
      SyncRazorpayPlanResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'string', example: 'DATA_UPDATED' },
          message: { type: 'string' },
          data: { $ref: '#/components/schemas/SyncRazorpayPlanResult' },
        },
      },
      SyncRazorpayPlansResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'string', example: 'DATA_UPDATED' },
          message: { type: 'string' },
          data: { $ref: '#/components/schemas/SyncRazorpayPlansResult' },
        },
      },
      CreateUserSubscriptionRequest: {
        type: 'object',
        required: ['planId', 'billingCycle'],
        additionalProperties: false,
        properties: {
          planId: { type: 'integer', minimum: 1 },
          billingCycle: { type: 'string', enum: ['monthly', 'yearly'] },
          totalCount: { type: 'integer', minimum: 1, maximum: 1200 },
        },
      },
      VerifyUserSubscriptionRequest: {
        type: 'object',
        required: ['razorpayPaymentId', 'razorpaySubscriptionId', 'razorpaySignature'],
        additionalProperties: false,
        properties: {
          razorpayPaymentId: { type: 'string' },
          razorpaySubscriptionId: { type: 'string' },
          razorpaySignature: { type: 'string' },
        },
      },
      CancelUserSubscriptionRequest: {
        type: 'object',
        additionalProperties: false,
        properties: {
          cancelAtCycleEnd: { type: 'boolean', default: false },
        },
      },
      UserSubscription: {
        type: 'object',
        required: [
          'id',
          'userId',
          'planId',
          'billingCycle',
          'status',
          'razorpaySubscriptionId',
          'razorpayPlanId',
          'totalCount',
          'paidCount',
          'quantity',
          'cancelAtCycleEnd',
          'createdAt',
        ],
        properties: {
          id: { type: 'string', example: '1' },
          userId: { type: 'string' },
          planId: { type: 'integer' },
          billingCycle: { type: 'string', enum: ['monthly', 'yearly'] },
          status: {
            type: 'string',
            enum: [
              'created',
              'authenticated',
              'active',
              'pending',
              'halted',
              'paused',
              'cancelled',
              'completed',
              'expired',
            ],
          },
          razorpaySubscriptionId: { type: 'string' },
          razorpayCustomerId: { type: 'string', nullable: true },
          razorpayPlanId: { type: 'string' },
          totalCount: { type: 'integer' },
          paidCount: { type: 'integer' },
          remainingCount: { type: 'integer', nullable: true },
          quantity: { type: 'integer' },
          currentStart: { type: 'string', format: 'date-time', nullable: true },
          currentEnd: { type: 'string', format: 'date-time', nullable: true },
          chargeAt: { type: 'string', format: 'date-time', nullable: true },
          checkoutVerifiedAt: { type: 'string', format: 'date-time', nullable: true },
          cancelledAt: { type: 'string', format: 'date-time', nullable: true },
          cancelAtCycleEnd: { type: 'boolean' },
          pausedAt: { type: 'string', format: 'date-time', nullable: true },
          endedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
          plan: { $ref: '#/components/schemas/SubscriptionPlan' },
        },
      },
      CreateCheckoutResponse: {
        type: 'object',
        required: [
          'subscriptionId',
          'razorpaySubscriptionId',
          'razorpayKeyId',
          'checkoutRequired',
          'status',
          'plan',
          'checkout',
        ],
        properties: {
          subscriptionId: { type: 'string', nullable: true },
          razorpaySubscriptionId: { type: 'string', nullable: true },
          razorpayKeyId: { type: 'string', nullable: true, description: 'Public Razorpay key id only' },
          checkoutRequired: { type: 'boolean' },
          status: { type: 'string' },
          plan: { $ref: '#/components/schemas/SubscriptionPlan' },
          checkout: {
            type: 'object',
            nullable: true,
            required: ['subscriptionId', 'name', 'description', 'prefill'],
            properties: {
              subscriptionId: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              prefill: {
                type: 'object',
                properties: {
                  contact: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  name: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
      CreateCheckoutResponseEnvelope: {
        type: 'object',
        required: ['success', 'code', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'string', example: 'DATA_SAVED' },
          message: { type: 'string' },
          data: { $ref: '#/components/schemas/CreateCheckoutResponse' },
        },
      },
      UserSubscriptionResponse: {
        type: 'object',
        required: ['success', 'code', 'message'],
        properties: {
          success: { type: 'boolean' },
          code: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
          message: { type: 'string' },
          data: { $ref: '#/components/schemas/UserSubscription' },
        },
      },
      UserSubscriptionUpdatedResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'string', example: 'DATA_UPDATED' },
          message: { type: 'string' },
          data: { $ref: '#/components/schemas/UserSubscription' },
        },
      },
      WebhookAckResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { oneOf: [{ type: 'integer' }, { type: 'string' }], example: 200 },
          message: { type: 'string', example: 'Success' },
          data: {
            type: 'object',
            properties: {
              received: { type: 'boolean' },
              duplicate: { type: 'boolean' },
              ignored: { type: 'boolean' },
            },
          },
        },
      },
      SubscriptionSavedResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'string', example: 'DATA_SAVED' },
          message: { type: 'string', example: 'Data saved successfully' },
          data: { $ref: '#/components/schemas/SubscriptionPlan' },
        },
      },
      SubscriptionUpdatedResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          code: { type: 'string', example: 'DATA_UPDATED' },
          message: { type: 'string', example: 'Data updated successfully' },
          data: { $ref: '#/components/schemas/SubscriptionPlan' },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'code', 'message'],
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string' },
          message: { type: 'string' },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        required: ['success', 'code', 'message', 'errors'],
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              required: ['field', 'message'],
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;
