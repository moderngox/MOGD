ALTER TABLE `exercise` ADD `allowedSessionRoles` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercise` ADD `preferredSessionRole` text;--> statement-breakpoint
ALTER TABLE `workout_exercise` ADD `roleReason` text;--> statement-breakpoint
ALTER TABLE `workout_exercise` ADD `supersetGroupId` text;