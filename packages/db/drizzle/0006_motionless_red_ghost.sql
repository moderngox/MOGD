CREATE TABLE `assessment_draft` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`step` integer NOT NULL,
	`formState` text NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_draft_userId_unique` ON `assessment_draft` (`userId`);