CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`eventType` enum('VISIT_ASSIGNED','VISIT_STATE_CHANGED','STAFF_MEMBERSHIP_STATUS_CHANGED') NOT NULL,
	`resourceType` varchar(32) NOT NULL,
	`resourceId` int NOT NULL,
	`summary` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_events_clinic_created_idx` ON `audit_events` (`clinicId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_events_resource_idx` ON `audit_events` (`resourceType`,`resourceId`);