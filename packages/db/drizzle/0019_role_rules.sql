CREATE TABLE `role_rules_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`createdByUserId` text,
	`note` text,
	`rules` text NOT NULL,
	FOREIGN KEY (`createdByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `program` ADD `roleRulesRevisionId` text;