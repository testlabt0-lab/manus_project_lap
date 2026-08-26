CREATE TABLE `staff_availability_windows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicId` int NOT NULL,
	`staffUserId` int NOT NULL,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`cancelledAt` timestamp,
	CONSTRAINT `staff_availability_windows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `staff_availability_clinic_start_idx` ON `staff_availability_windows` (`clinicId`,`startAt`);--> statement-breakpoint
CREATE INDEX `staff_availability_staff_start_idx` ON `staff_availability_windows` (`staffUserId`,`startAt`);