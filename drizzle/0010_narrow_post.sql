CREATE TABLE `manager_notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerUserId` int NOT NULL,
	`minimumAcknowledgementRate` int NOT NULL DEFAULT 70,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manager_notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `manager_notification_preferences_manager_unique` UNIQUE(`managerUserId`)
);
