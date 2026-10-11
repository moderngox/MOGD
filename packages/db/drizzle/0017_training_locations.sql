CREATE TABLE `training_location` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_location_user_name` ON `training_location` (`userId`,`name`);--> statement-breakpoint
ALTER TABLE `workout_session` ADD `trainingLocationId` text REFERENCES training_location(id) ON DELETE set null;