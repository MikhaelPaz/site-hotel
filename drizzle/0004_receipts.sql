CREATE TABLE `receipts` (
	`booking_id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`data` text NOT NULL,
	`uploaded` text NOT NULL,
	`uploaded_by` text
);
