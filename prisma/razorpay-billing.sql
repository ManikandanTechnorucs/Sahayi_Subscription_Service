-- Razorpay billing tables / columns for Sahayi Subscription Service
-- Apply against the shared MySQL database (coordinate with User Service owners).

ALTER TABLE subscriptionmaster
  ADD COLUMN RazorpayPlanIdMonthly VARCHAR(40) NULL,
  ADD COLUMN RazorpayPlanIdYearly VARCHAR(40) NULL;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  Id BIGINT NOT NULL AUTO_INCREMENT,
  UserId VARCHAR(64) NOT NULL,
  PlanId INT NOT NULL,
  BillingCycle ENUM('monthly', 'yearly') NOT NULL,
  Status ENUM('created','authenticated','active','pending','halted','paused','cancelled','completed','expired') NOT NULL DEFAULT 'created',
  RazorpaySubscriptionId VARCHAR(40) NOT NULL,
  RazorpayCustomerId VARCHAR(40) NULL,
  RazorpayPlanId VARCHAR(40) NOT NULL,
  TotalCount INT NOT NULL,
  PaidCount INT NOT NULL DEFAULT 0,
  RemainingCount INT NULL,
  Quantity INT NOT NULL DEFAULT 1,
  CurrentStart DATETIME NULL,
  CurrentEnd DATETIME NULL,
  ChargeAt DATETIME NULL,
  CheckoutVerifiedAt DATETIME NULL,
  CancelledAt DATETIME NULL,
  CancelAtCycleEnd TINYINT(1) NOT NULL DEFAULT 0,
  PausedAt DATETIME NULL,
  EndedAt DATETIME NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NULL,
  PRIMARY KEY (Id),
  UNIQUE KEY UX_UserSubscription_RazorpaySubscriptionId (RazorpaySubscriptionId),
  KEY IX_UserSubscription_UserId_Status (UserId, Status),
  CONSTRAINT FK_UserSubscription_Plan FOREIGN KEY (PlanId) REFERENCES subscriptionmaster (Id)
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  Id BIGINT NOT NULL AUTO_INCREMENT,
  UserSubscriptionId BIGINT NOT NULL,
  RazorpayPaymentId VARCHAR(40) NOT NULL,
  Amount INT NULL,
  Currency VARCHAR(10) NULL,
  Status VARCHAR(40) NOT NULL,
  PaidAt DATETIME NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NULL,
  PRIMARY KEY (Id),
  UNIQUE KEY UX_SubscriptionPayment_RazorpayPaymentId (RazorpayPaymentId),
  KEY IX_SubscriptionPayment_UserSubscriptionId (UserSubscriptionId),
  CONSTRAINT FK_SubscriptionPayment_UserSubscription FOREIGN KEY (UserSubscriptionId) REFERENCES user_subscriptions (Id)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  Id BIGINT NOT NULL AUTO_INCREMENT,
  EventId VARCHAR(100) NOT NULL,
  EventType VARCHAR(100) NOT NULL,
  RazorpaySubscriptionId VARCHAR(40) NULL,
  ProcessingStatus ENUM('processed','ignored','failed') NOT NULL DEFAULT 'processed',
  ErrorMessage VARCHAR(500) NULL,
  ProcessedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY UX_WebhookEvent_EventId (EventId),
  KEY IX_WebhookEvent_RazorpaySubscriptionId (RazorpaySubscriptionId)
);

CREATE TABLE IF NOT EXISTS usersubscriptionhistory (
  Id BIGINT NOT NULL AUTO_INCREMENT,
  UserId VARCHAR(64) NOT NULL,
  UserSubscriptionId BIGINT NOT NULL,
  PlanId INT NOT NULL,
  BillingCycle ENUM('monthly', 'yearly') NOT NULL,
  FromStatus ENUM('created','authenticated','active','pending','halted','paused','cancelled','completed','expired') NULL,
  ToStatus ENUM('created','authenticated','active','pending','halted','paused','cancelled','completed','expired') NOT NULL,
  EventSource VARCHAR(40) NOT NULL,
  EventType VARCHAR(100) NULL,
  RazorpaySubscriptionId VARCHAR(40) NOT NULL,
  Note VARCHAR(255) NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  KEY IX_UserSubscriptionHistory_UserId_CreatedAt (UserId, CreatedAt),
  KEY IX_UserSubscriptionHistory_UserSubscriptionId_CreatedAt (UserSubscriptionId, CreatedAt),
  CONSTRAINT FK_UserSubscriptionHistory_UserSubscription FOREIGN KEY (UserSubscriptionId) REFERENCES user_subscriptions (Id)
);
