CREATE TABLE `group` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_invite_token_hash_unique` ON `group_invite` (`token_hash`);--> statement-breakpoint
CREATE INDEX `group_invite_group_idx` ON `group_invite` (`group_id`);--> statement-breakpoint
CREATE TABLE `group_member` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_member_group_user_idx` ON `group_member` (`group_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `group_member_user_idx` ON `group_member` (`user_id`);--> statement-breakpoint
CREATE TABLE `meal_plan_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`recipe_id` text,
	`servings` real,
	`note` text,
	`position` integer NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_plan_entry_group_date_idx` ON `meal_plan_entry` (`group_id`,`date`);--> statement-breakpoint
CREATE TABLE `recipe_share` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`group_id` text NOT NULL,
	`shared_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_share_recipe_group_idx` ON `recipe_share` (`recipe_id`,`group_id`);--> statement-breakpoint
CREATE INDEX `recipe_share_group_idx` ON `recipe_share` (`group_id`);--> statement-breakpoint
INSERT INTO `group` (`id`, `name`, `created_by_id`) SELECT 'dfcab55f-7c6c-48b7-b2f7-5935e7435987', 'Home', `id` FROM `user` ORDER BY `created_at`, `id` LIMIT 1;--> statement-breakpoint
INSERT INTO `group_member` (`id`, `group_id`, `user_id`, `role`, `joined_at`) SELECT lower(hex(randomblob(16))), 'dfcab55f-7c6c-48b7-b2f7-5935e7435987', `id`, 'admin', `created_at` FROM `user`;--> statement-breakpoint
INSERT INTO `recipe_share` (`id`, `recipe_id`, `group_id`, `shared_by_id`, `created_at`) SELECT lower(hex(randomblob(16))), `id`, 'dfcab55f-7c6c-48b7-b2f7-5935e7435987', `created_by_id`, `created_at` FROM `recipe`;--> statement-breakpoint
CREATE TABLE `__new_shopping_item` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`ingredient_id` text,
	`name` text NOT NULL,
	`grams` real,
	`quantity` real,
	`unit` text,
	`recipe_id` text,
	`checked` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_shopping_item` (`id`, `group_id`, `ingredient_id`, `name`, `grams`, `quantity`, `unit`, `recipe_id`, `checked`, `created_at`) SELECT `id`, 'dfcab55f-7c6c-48b7-b2f7-5935e7435987', `ingredient_id`, `name`, `grams`, `quantity`, `unit`, `recipe_id`, `checked`, `created_at` FROM `shopping_item` WHERE EXISTS (SELECT 1 FROM `group` WHERE `id` = 'dfcab55f-7c6c-48b7-b2f7-5935e7435987');--> statement-breakpoint
DROP TABLE `shopping_item`;--> statement-breakpoint
ALTER TABLE `__new_shopping_item` RENAME TO `shopping_item`;--> statement-breakpoint
CREATE INDEX `shopping_item_group_idx` ON `shopping_item` (`group_id`);--> statement-breakpoint
CREATE TABLE `__new_pantry_item` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`grams` real,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_pantry_item` (`id`, `group_id`, `ingredient_id`, `grams`, `updated_at`) SELECT `id`, 'dfcab55f-7c6c-48b7-b2f7-5935e7435987', `ingredient_id`, `grams`, `updated_at` FROM `pantry_item` WHERE EXISTS (SELECT 1 FROM `group` WHERE `id` = 'dfcab55f-7c6c-48b7-b2f7-5935e7435987');--> statement-breakpoint
DROP TABLE `pantry_item`;--> statement-breakpoint
ALTER TABLE `__new_pantry_item` RENAME TO `pantry_item`;--> statement-breakpoint
CREATE UNIQUE INDEX `pantry_item_group_ingredient_idx` ON `pantry_item` (`group_id`,`ingredient_id`);