CREATE TABLE `staff_weekly_capacity_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`staffUserId` int NOT NULL,
	`targetActiveAssignments` int NOT NULL DEFAULT 5,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_weekly_capacity_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_weekly_capacity_clinic_staff_unique` UNIQUE(`clinicId`,`staffUserId`)
);
