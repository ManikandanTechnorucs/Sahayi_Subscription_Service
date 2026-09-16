-- Period-end downgrade / cycle-change: delayed Razorpay replacement
-- Apply against the shared MySQL database.

ALTER TABLE user_subscriptions
  ADD COLUMN ReplacesUserSubscriptionId BIGINT NULL,
  ADD COLUMN ScheduledStartAt DATETIME NULL,
  ADD KEY IX_UserSubscription_ReplacesUserSubscriptionId (ReplacesUserSubscriptionId);
