-- Allow catalog-only history rows (e.g. Free) when a user pays for a new plan.
-- Run this manually against the shared MySQL database if usersubscriptionhistory already exists.

ALTER TABLE usersubscriptionhistory
  DROP FOREIGN KEY FK_UserSubscriptionHistory_UserSubscription;

ALTER TABLE usersubscriptionhistory
  MODIFY UserSubscriptionId BIGINT NULL,
  MODIFY BillingCycle ENUM('monthly', 'yearly') NULL,
  MODIFY ToStatus ENUM('created','authenticated','active','pending','halted','paused','cancelled','completed','expired') NULL,
  MODIFY RazorpaySubscriptionId VARCHAR(40) NULL;

ALTER TABLE usersubscriptionhistory
  ADD CONSTRAINT FK_UserSubscriptionHistory_UserSubscription
    FOREIGN KEY (UserSubscriptionId) REFERENCES user_subscriptions (Id);
