CREATE TABLE `clinic_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicName` varchar(160) NOT NULL,
	`userId` int NOT NULL,
	`memberRole` enum('MANAGER','CLINICIAN','NURSE') NOT NULL,
	`status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clinic_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`invoiceNo` varchar(32) NOT NULL,
	`totalHalalas` int NOT NULL,
	`status` enum('DUE','PAID') NOT NULL DEFAULT 'DUE',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_visitId_unique` UNIQUE(`visitId`),
	CONSTRAINT `invoices_invoiceNo_unique` UNIQUE(`invoiceNo`)
);
--> statement-breakpoint
CREATE TABLE `medical_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`status` enum('FINALIZED') NOT NULL DEFAULT 'FINALIZED',
	`summary` text NOT NULL,
	`finalizedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medical_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `medical_reports_visitId_unique` UNIQUE(`visitId`)
);
--> statement-breakpoint
CREATE INDEX `clinic_memberships_user_status_idx` ON `clinic_memberships` (`userId`,`status`);