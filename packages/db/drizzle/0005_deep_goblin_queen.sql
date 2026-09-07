CREATE TABLE `checkin` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`averageWeightKg` real NOT NULL,
	`waistCm` real NOT NULL,
	`trainingAdherencePercent` integer NOT NULL,
	`nutritionAdherencePercent` integer NOT NULL,
	`hunger` integer NOT NULL,
	`energy` integer NOT NULL,
	`recovery` integer NOT NULL,
	`performanceNote` text,
	`note` text,
	`completedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plan_adjustment` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`checkinId` text NOT NULL,
	`decisionType` text NOT NULL,
	`outcome` text NOT NULL,
	`previousEnergyKcal` real,
	`newEnergyKcal` real,
	`reason` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`checkinId`) REFERENCES `checkin`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `progress_photo` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`checkinId` text NOT NULL,
	`angle` text NOT NULL,
	`objectKey` text NOT NULL,
	`consentGrantedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`checkinId`) REFERENCES `checkin`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_photo_checkin_angle_idx` ON `progress_photo` (`checkinId`,`angle`);