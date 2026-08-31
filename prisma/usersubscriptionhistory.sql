-- History table only (if other Razorpay tables already exist).
-- Run this manually against the shared MySQL database.

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
