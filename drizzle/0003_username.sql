-- O login passa a ser um USUÁRIO (ex.: "admin") em vez de e-mail.
ALTER TABLE `users` RENAME COLUMN `email` TO `username`;--> statement-breakpoint
DROP INDEX `idx_users_email`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`);--> statement-breakpoint
-- O administrador inicial passa a entrar com o usuário "admin" (mesma senha de antes).
UPDATE `users` SET `username` = 'admin' WHERE `username` = 'ht12bilmontanha@gmail.com';
