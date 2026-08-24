ALTER TABLE `clinic_memberships` ADD `clinicId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `visits` ADD `clinicId` int DEFAULT 1 NOT NULL;