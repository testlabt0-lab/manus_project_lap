CREATE TABLE `manager_notification_analytics_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerUserId` int NOT NULL,
	`clinicId` int NOT NULL,
	`periodDays` int NOT NULL,
	`total` int NOT NULL,
	`pending` int NOT NULL,
	`acknowledged` int NOT NULL,
	`acknowledgementRate` int NOT NULL,
	`averageResponseMinutes` int,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manager_notification_analytics_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `manager_notification_snapshots_manager_clinic_captured_idx` ON `manager_notification_analytics_snapshots` (`managerUserId`,`clinicId`,`capturedAt`);