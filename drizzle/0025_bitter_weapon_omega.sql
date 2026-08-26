CREATE TABLE `field_sync_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actionId` varchar(120) NOT NULL,
	`visitId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`appliedState` enum('REQUESTED','ASSIGNED','CONFIRMED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `field_sync_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `field_sync_receipts_actionId_unique` UNIQUE(`actionId`)
);
--> statement-breakpoint
CREATE INDEX `field_sync_receipts_visit_idx` ON `field_sync_receipts` (`visitId`,`createdAt`);