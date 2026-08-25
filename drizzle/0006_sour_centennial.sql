CREATE TABLE `mobile_auth_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nonce` varchar(96) NOT NULL,
	`appRedirectUri` varchar(255) NOT NULL,
	`appState` varchar(512) NOT NULL,
	`codeChallenge` varchar(128) NOT NULL,
	`authorizationCodeHash` varchar(64),
	`userId` int,
	`expiresAt` timestamp NOT NULL,
	`authorizedAt` timestamp,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mobile_auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `mobile_auth_sessions_nonce_unique` UNIQUE(`nonce`),
	CONSTRAINT `mobile_auth_sessions_authorizationCodeHash_unique` UNIQUE(`authorizationCodeHash`)
);
--> statement-breakpoint
CREATE INDEX `mobile_auth_sessions_expiry_idx` ON `mobile_auth_sessions` (`expiresAt`);