CREATE TABLE `exercise_programming_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`exerciseId` text NOT NULL,
	`traineeLevel` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`isInheritedDefault` integer DEFAULT false NOT NULL,
	`setsMin` integer NOT NULL,
	`setsMax` integer NOT NULL,
	`repsMin` integer NOT NULL,
	`repsMax` integer NOT NULL,
	`rirMin` integer NOT NULL,
	`rirMax` integer NOT NULL,
	`restSecondsMin` integer NOT NULL,
	`restSecondsMax` integer NOT NULL,
	`prescriptionType` text DEFAULT 'rir' NOT NULL,
	`progressionType` text DEFAULT 'double_progression' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`exerciseId`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_programming_profile_exercise_level` ON `exercise_programming_profile` (`exerciseId`,`traineeLevel`);--> statement-breakpoint
ALTER TABLE `exercise_log` ADD `painFlag` integer;--> statement-breakpoint
ALTER TABLE `exercise_log` ADD `techniqueValid` integer;--> statement-breakpoint
ALTER TABLE `exercise` DROP COLUMN `defaultRepMin`;--> statement-breakpoint
ALTER TABLE `exercise` DROP COLUMN `defaultRepMax`;