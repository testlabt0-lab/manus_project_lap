CREATE TABLE `manager_notification_delivery_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerUserId` int NOT NULL,
	`clinicId` int NOT NULL,
	`channel` enum('IN_APP','EMAIL','SMS') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manager_notification_delivery_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `manager_notification_delivery_preferences_unique` UNIQUE(`managerUserId`,`clinicId`,`channel`)
);
--> statement-breakpoint
CREATE TABLE `notification_delivery_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerUserId` int NOT NULL,
	`clinicId` int NOT NULL,
	`channel` enum('IN_APP','EMAIL','SMS') NOT NULL,
	`notificationType` varchar(40) NOT NULL,
	`status` enum('SIMULATED','SKIPPED','DISABLED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_delivery_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `notification_delivery_logs_manager_clinic_created_idx` ON `notification_delivery_logs` (`managerUserId`,`clinicId`,`createdAt`);