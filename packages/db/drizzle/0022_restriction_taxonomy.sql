CREATE TABLE `restriction_category` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restriction_category_key_unique` ON `restriction_category` (`key`);--> statement-breakpoint
ALTER TABLE `training_profile` ADD `restrictionKeys` text DEFAULT '[]' NOT NULL;