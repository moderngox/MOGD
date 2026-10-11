CREATE TABLE `__new_exercise_log` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`exerciseId` text NOT NULL,
	`workoutExercisePerformanceId` text,
	`setNumber` integer NOT NULL,
	`loadKg` real,
	`reps` integer NOT NULL,
	`rir` integer,
	`painFlag` integer,
	`techniqueValid` integer,
	`completedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exerciseId`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workoutExercisePerformanceId`) REFERENCES `workout_exercise_performance`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_exercise_log`(`id`, `userId`, `exerciseId`, `workoutExercisePerformanceId`, `setNumber`, `loadKg`, `reps`, `rir`, `painFlag`, `techniqueValid`, `completedAt`) SELECT `id`, `userId`, `exerciseId`, `workoutExercisePerformanceId`, `setNumber`, `loadKg`, `reps`, `rir`, `painFlag`, `techniqueValid`, `completedAt` FROM `exercise_log`;
--> statement-breakpoint
DROP TABLE `exercise_log`;
--> statement-breakpoint
ALTER TABLE `__new_exercise_log` RENAME TO `exercise_log`;
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_log_performance_set` ON `exercise_log` (`workoutExercisePerformanceId`,`setNumber`);
