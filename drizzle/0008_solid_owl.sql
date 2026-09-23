CREATE TABLE `email_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`user_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `flame_days` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_id` text NOT NULL,
	`day` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flame_days_user_day_unique` ON `flame_days` (`user_id`,`day`);--> statement-breakpoint
CREATE UNIQUE INDEX `flame_days_task_unique` ON `flame_days` (`task_id`);--> statement-breakpoint
CREATE TABLE `flame_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`milestone` integer NOT NULL,
	`amount` integer NOT NULL,
	`day` text NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flame_rewards_user_milestone_day_unique` ON `flame_rewards` (`user_id`,`milestone`,`day`);--> statement-breakpoint
ALTER TABLE `applications` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);