CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`purpose` text NOT NULL,
	`room` text,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_bookings_room_dates` ON `bookings` (`room`,`start`,`end`);--> statement-breakpoint
CREATE INDEX `idx_bookings_status_created` ON `bookings` (`status`,`created`);