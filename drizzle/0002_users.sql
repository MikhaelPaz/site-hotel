CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'equipe' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`last_login` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created` text NOT NULL,
	`expires` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
-- Administrador inicial: o mesmo e-mail e senha que antes estavam escritos
-- no código (a senha fica guardada só como hash). TROQUE A SENHA no primeiro
-- acesso, em Equipe > Administração.
INSERT OR IGNORE INTO `users` (`id`, `email`, `name`, `password_hash`, `role`, `active`, `created`, `updated`)
VALUES (lower(hex(randomblob(16))), 'ht12bilmontanha@gmail.com', 'Administrador', 'pbkdf2$100000$77229db11b9b1f2ff569a1d61024a3f8$76716878f1b5b511e752c642ee2208fe8811f348241df3f8b9e8d6d2cff7cbcc', 'admin', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
