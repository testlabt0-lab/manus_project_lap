CREATE TABLE `mobile_refresh_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(80) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`rotatedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mobile_refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `mobile_refresh_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `patient_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`visitId` int,
	`kind` enum('VISIT_CREATED','VISIT_STATUS_CHANGED') NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` varchar(255) NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patient_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `mobile_refresh_tokens_user_expiry_idx` ON `mobile_refresh_tokens` (`userId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `patient_notifications_user_created_idx` ON `patient_notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `patient_notifications_user_read_idx` ON `patient_notifications` (`userId`,`readAt`);