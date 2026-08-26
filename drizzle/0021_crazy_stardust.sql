ALTER TABLE `medical_reports` MODIFY COLUMN `status` enum('DRAFT','FINALIZED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `medical_reports` MODIFY COLUMN `finalizedAt` timestamp;--> statement-breakpoint
ALTER TABLE `medical_reports` ADD `templateCode` varchar(40) DEFAULT 'HOME_VISIT' NOT NULL;--> statement-breakpoint
ALTER TABLE `medical_reports` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;