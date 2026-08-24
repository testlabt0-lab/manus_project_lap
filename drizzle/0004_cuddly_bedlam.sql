CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`providerReference` varchar(48) NOT NULL,
	`amountHalalas` int NOT NULL,
	`status` enum('RECORDED') NOT NULL DEFAULT 'RECORDED',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_providerReference_unique` UNIQUE(`providerReference`)
);
--> statement-breakpoint
ALTER TABLE `medical_reports` ADD `authoredByUserId` int;--> statement-breakpoint
ALTER TABLE `visit_assignments` ADD `assigneeUserId` int;--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoiceId`);