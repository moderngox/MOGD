CREATE TABLE `exercise_log` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`exerciseId` text NOT NULL,
	`workoutId` text,
	`setNumber` integer NOT NULL,
	`loadKg` real,
	`reps` integer NOT NULL,
	`rir` integer,
	`completedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exerciseId`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workoutId`) REFERENCES `workout`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `program` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`splitType` text NOT NULL,
	`sessionsPerWeek` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `program_userId_unique` ON `program` (`userId`);--> statement-breakpoint
CREATE TABLE `workout_exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`workoutId` text NOT NULL,
	`exerciseId` text NOT NULL,
	`orderIndex` integer NOT NULL,
	`sets` integer NOT NULL,
	`repMin` integer NOT NULL,
	`repMax` integer NOT NULL,
	`rir` integer NOT NULL,
	`restSeconds` integer NOT NULL,
	FOREIGN KEY (`workoutId`) REFERENCES `workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exerciseId`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout` (
	`id` text PRIMARY KEY NOT NULL,
	`programId` text NOT NULL,
	`dayIndex` integer NOT NULL,
	`sessionLabel` text NOT NULL,
	`estimatedDurationMinutes` integer NOT NULL,
	FOREIGN KEY (`programId`) REFERENCES `program`(`id`) ON UPDATE no action ON DELETE cascade
);
