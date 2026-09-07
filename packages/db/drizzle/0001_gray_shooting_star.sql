CREATE TABLE `assessment_photo` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`angle` text NOT NULL,
	`objectKey` text NOT NULL,
	`consentGrantedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_photo_user_angle_idx` ON `assessment_photo` (`userId`,`angle`);--> statement-breakpoint
CREATE TABLE `assessment` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`status` text NOT NULL,
	`optionalNote` text,
	`completedAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_userId_unique` ON `assessment` (`userId`);--> statement-breakpoint
CREATE TABLE `body_measurement` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`sex` text NOT NULL,
	`age` integer NOT NULL,
	`heightCm` real NOT NULL,
	`weightKg` real NOT NULL,
	`waistCm` real NOT NULL,
	`targetWeightKg` real,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `body_measurement_userId_unique` ON `body_measurement` (`userId`);--> statement-breakpoint
CREATE TABLE `nutrition_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`dietaryPreference` text NOT NULL,
	`allergies` text,
	`mealsPerDay` integer NOT NULL,
	`cookingPreference` text NOT NULL,
	`dislikedFoods` text,
	`willingToTrackCalories` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nutrition_profile_userId_unique` ON `nutrition_profile` (`userId`);--> statement-breakpoint
CREATE TABLE `physique_goal` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`primaryGoal` text NOT NULL,
	`physiquePriorities` text NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `physique_goal_userId_unique` ON `physique_goal` (`userId`);--> statement-breakpoint
CREATE TABLE `training_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`experienceLevel` text NOT NULL,
	`trainingConsistency` text NOT NULL,
	`currentActivityLevel` text NOT NULL,
	`trainingHistoryNotes` text,
	`limitations` text,
	`injuryRestrictions` text,
	`sessionsPerWeek` integer NOT NULL,
	`sessionDurationMinutes` integer NOT NULL,
	`trainingContext` text NOT NULL,
	`equipment` text NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_profile_userId_unique` ON `training_profile` (`userId`);