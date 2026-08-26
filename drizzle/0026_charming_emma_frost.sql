CREATE TABLE `field_sync_incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`failureCount` int NOT NULL,
	`status` enum('OPEN','ACKNOWLEDGED','RESOLVED') NOT NULL DEFAULT 'OPEN',
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`acknowledgedAt` timestamp,
	`resolvedAt` timestamp,
	`resolvedByUserId` int,
	CONSTRAINT `field_sync_incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `field_sync_incidents_clinic_status_idx` ON `field_sync_incidents` (`clinicId`,`status`,`openedAt`);