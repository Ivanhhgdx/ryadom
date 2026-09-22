CREATE TABLE `chat_reads` (
	`application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_id` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`application_id`, `user_id`),
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `geocode_cache` (
	`query` text PRIMARY KEY NOT NULL,
	`result` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`purpose` text NOT NULL,
	`task_id` text,
	`application_id` text,
	`mime` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_task_idx` ON `media` (`task_id`);--> statement-breakpoint
CREATE INDEX `media_owner_created_idx` ON `media` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`client_id` text NOT NULL,
	`body` text NOT NULL,
	`media_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_chat_id_idx` ON `messages` (`application_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_sender_client_idx` ON `messages` (`sender_id`,`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_media_idx` ON `messages` (`media_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `work_mode` text DEFAULT 'onsite' NOT NULL;