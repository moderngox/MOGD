CREATE TABLE `exercise_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`exerciseId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text,
	`generationModel` text,
	`objectKey` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`validationNotes` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`exerciseId`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_asset_one_approved_per_type` ON `exercise_asset` (`exerciseId`,`type`) WHERE "exercise_asset"."status" = 'approved';--> statement-breakpoint
CREATE TABLE `exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`canonicalId` text NOT NULL,
	`name` text NOT NULL,
	`movementPattern` text NOT NULL,
	`difficulty` text NOT NULL,
	`primaryMuscles` text NOT NULL,
	`secondaryMuscles` text NOT NULL,
	`equipment` text NOT NULL,
	`hypertrophyScore` real,
	`strengthScore` real,
	`fatigueScore` real,
	`stabilityDemand` real,
	`defaultRepMin` integer,
	`defaultRepMax` integer,
	`contraindicationTags` text NOT NULL,
	`instructions` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_canonicalId_unique` ON `exercise` (`canonicalId`);