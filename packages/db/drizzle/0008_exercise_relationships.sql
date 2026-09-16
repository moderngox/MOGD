CREATE TABLE `exercise_relationship` (
	`id` text PRIMARY KEY NOT NULL,
	`sourceExerciseId` text NOT NULL,
	`targetExerciseId` text NOT NULL,
	`relationshipType` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`sourceExerciseId`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`targetExerciseId`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "exercise_relationship_no_self" CHECK("exercise_relationship"."sourceExerciseId" != "exercise_relationship"."targetExerciseId")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_relationship_unique_edge` ON `exercise_relationship` (`sourceExerciseId`,`targetExerciseId`,`relationshipType`);--> statement-breakpoint
CREATE INDEX `exercise_relationship_source_idx` ON `exercise_relationship` (`sourceExerciseId`);--> statement-breakpoint
CREATE INDEX `exercise_relationship_target_idx` ON `exercise_relationship` (`targetExerciseId`);