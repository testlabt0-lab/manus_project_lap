CREATE TABLE `manager_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`managerUserId` int NOT NULL,
	`visitId` int NOT NULL,
	`notificationType` enum('OVERDUE_VISIT') NOT NULL,
	`title` varchar(160) NOT NULL,
	`message` varchar(255) NOT NULL,
	`acknowledgedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manager_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `manager_notifications_manager_created_idx` ON `manager_notifications` (`managerUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `manager_notifications_clinic_visit_idx` ON `manager_notifications` (`clinicId`,`visitId`);