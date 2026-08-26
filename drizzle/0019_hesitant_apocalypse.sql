CREATE TABLE `staff_service_zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`staffUserId` int NOT NULL,
	`zoneCode` enum('CENTRAL','NORTH','SOUTH','EAST','WEST') NOT NULL,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_service_zones_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_service_zones_clinic_staff_zone_unique` UNIQUE(`clinicId`,`staffUserId`,`zoneCode`)
);
--> statement-breakpoint
ALTER TABLE `visits` ADD `serviceZone` enum('CENTRAL','NORTH','SOUTH','EAST','WEST') DEFAULT 'CENTRAL' NOT NULL;--> statement-breakpoint
CREATE INDEX `staff_service_zones_clinic_staff_idx` ON `staff_service_zones` (`clinicId`,`staffUserId`);