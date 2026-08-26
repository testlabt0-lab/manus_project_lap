CREATE TABLE `clinic_visit_duration_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`durationMinutes` int NOT NULL DEFAULT 60,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinic_visit_duration_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `clinic_visit_duration_settings_clinic_unique` UNIQUE(`clinicId`)
);
