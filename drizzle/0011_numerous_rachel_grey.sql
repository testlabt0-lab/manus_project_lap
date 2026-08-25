ALTER TABLE `manager_notification_preferences` DROP INDEX `manager_notification_preferences_manager_unique`;--> statement-breakpoint
ALTER TABLE `manager_notification_preferences` ADD `clinicId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `manager_notification_preferences` ADD CONSTRAINT `manager_notification_preferences_manager_clinic_unique` UNIQUE(`managerUserId`,`clinicId`);