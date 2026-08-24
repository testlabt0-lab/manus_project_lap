CREATE TABLE `visit_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`assigneeLabel` varchar(120) NOT NULL,
	`assignedByUserId` int NOT NULL,
	`status` enum('PENDING','ACCEPTED') NOT NULL DEFAULT 'PENDING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visit_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visit_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`fromState` enum('REQUESTED','ASSIGNED','CONFIRMED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL,
	`toState` enum('REQUESTED','ASSIGNED','CONFIRMED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL,
	`changedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visit_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(24) NOT NULL,
	`patientId` int NOT NULL,
	`clinicName` varchar(160) NOT NULL,
	`serviceName` varchar(160) NOT NULL,
	`districtLabel` varchar(180) NOT NULL,
	`scheduledStart` timestamp NOT NULL,
	`state` enum('REQUESTED','ASSIGNED','CONFIRMED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'REQUESTED',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visits_id` PRIMARY KEY(`id`),
	CONSTRAINT `visits_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE INDEX `visit_assignments_visit_idx` ON `visit_assignments` (`visitId`);--> statement-breakpoint
CREATE INDEX `visit_history_visit_created_idx` ON `visit_status_history` (`visitId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `visits_patient_scheduled_idx` ON `visits` (`patientId`,`scheduledStart`);--> statement-breakpoint
CREATE INDEX `visits_state_scheduled_idx` ON `visits` (`state`,`scheduledStart`);