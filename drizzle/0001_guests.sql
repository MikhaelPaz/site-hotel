CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_guests_key` ON `guests` (`key`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `guest_id` text;--> statement-breakpoint
CREATE INDEX `idx_bookings_guest` ON `bookings` (`guest_id`);--> statement-breakpoint
-- Preenche o cadastro com os hóspedes das reservas que já existem: um
-- registro por e-mail + nome (sem diferenciar maiúsculas/minúsculas),
-- mantendo o telefone/e-mail/nome da reserva mais recente.
INSERT INTO `guests` (`id`, `key`, `name`, `email`, `phone`, `created`, `updated`)
SELECT lower(hex(randomblob(16))), `k`, trim(`name`), trim(`email`), trim(`phone`), `first_created`, `created`
FROM (
	SELECT
		lower(trim(`email`)) || '|' || lower(trim(`name`)) AS `k`,
		`name`, `email`, `phone`, `created`,
		MIN(`created`) OVER (PARTITION BY lower(trim(`email`)) || '|' || lower(trim(`name`))) AS `first_created`,
		ROW_NUMBER() OVER (PARTITION BY lower(trim(`email`)) || '|' || lower(trim(`name`)) ORDER BY `created` DESC) AS `rn`
	FROM `bookings`
)
WHERE `rn` = 1;--> statement-breakpoint
-- Liga cada reserva existente ao seu hóspede.
UPDATE `bookings` SET `guest_id` = (
	SELECT `g`.`id` FROM `guests` `g`
	WHERE `g`.`key` = lower(trim(`bookings`.`email`)) || '|' || lower(trim(`bookings`.`name`))
);
