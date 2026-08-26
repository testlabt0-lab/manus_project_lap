CREATE TABLE `staff_service_skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`staffUserId` int NOT NULL,
	`skillCode` enum('GENERAL_HOME_VISIT','MOBILITY_ASSISTANCE','MEDICATION_SUPPORT','SAMPLE_COLLECTION') NOT NULL,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_service_skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_service_skills_clinic_staff_skill_unique` UNIQUE(`clinicId`,`staffUserId`,`skillCode`)
);
--> statement-breakpoint
ALTER TABLE `visits` ADD `requiredStaffSkill` enum('GENERAL_HOME_VISIT','MOBILITY_ASSISTANCE','MEDICATION_SUPPORT','SAMPLE_COLLECTION') DEFAULT 'GENERAL_HOME_VISIT' NOT NULL;--> statement-breakpoint
CREATE INDEX `staff_service_skills_clinic_staff_idx` ON `staff_service_skills` (`clinicId`,`staffUserId`);