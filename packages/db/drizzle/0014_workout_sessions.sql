CREATE TABLE `workout_exercise_performance` (
	`id` text PRIMARY KEY NOT NULL,
	`workoutSessionId` text NOT NULL,
	`exerciseId` text NOT NULL,
	`orderIndex` integer NOT NULL,
	`sessionRole` text,
	`roleReason` text,
	`sets` integer NOT NULL,
	`repMin` integer NOT NULL,
	`repMax` integer NOT NULL,
	`rirMin` integer NOT NULL,
	`rirMax` integer NOT NULL,
	`restSeconds` integer NOT NULL,
	`recommendedLoadKg` real,
	`recommendationReason` text NOT NULL,
	`loadInstruction` text,
	`targetRepMin` integer NOT NULL,
	`targetRepMax` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workoutSessionId`) REFERENCES `workout_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exerciseId`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_exercise_performance_session_exercise` ON `workout_exercise_performance` (`workoutSessionId`,`exerciseId`);--> statement-breakpoint
CREATE TABLE `workout_session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`workoutId` text,
	`sessionLabel` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`startedAt` integer NOT NULL,
	`completedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workoutId`) REFERENCES `workout`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_session_one_in_progress_per_slot` ON `workout_session` (`userId`,`workoutId`) WHERE "workout_session"."status" = 'in_progress';--> statement-breakpoint
ALTER TABLE `exercise_log` ADD `workoutExercisePerformanceId` text REFERENCES workout_exercise_performance(id) ON DELETE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_log_performance_set` ON `exercise_log` (`workoutExercisePerformanceId`,`setNumber`);