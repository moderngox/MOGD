CREATE TABLE `goal_strategy` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`primaryGoal` text NOT NULL,
	`priorityMuscles` text NOT NULL,
	`energyDirection` text NOT NULL,
	`trainingBias` text NOT NULL,
	`computedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_strategy_userId_unique` ON `goal_strategy` (`userId`);--> statement-breakpoint
CREATE TABLE `nutrition_target` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`bmr` real NOT NULL,
	`tdee` real NOT NULL,
	`energyDirection` text NOT NULL,
	`energyKcal` real NOT NULL,
	`proteinG` real NOT NULL,
	`fatG` real NOT NULL,
	`carbG` real NOT NULL,
	`computedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nutrition_target_userId_unique` ON `nutrition_target` (`userId`);