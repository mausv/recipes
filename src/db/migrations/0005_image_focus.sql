ALTER TABLE `recipe` ADD `cover_focus_x` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipe` ADD `cover_focus_y` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipe_step` ADD `image_focus_x` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipe_step` ADD `image_focus_y` integer DEFAULT 50 NOT NULL;