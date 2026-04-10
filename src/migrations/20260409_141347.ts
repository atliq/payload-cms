import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`authors\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`profile_id\` integer NOT NULL,
  	\`linkedin_url\` text,
  	\`description\` text,
  	\`legacy_description\` text,
  	\`seo_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_canonical_url\` text,
  	\`seo_no_index\` integer DEFAULT false,
  	\`seo_no_follow\` integer DEFAULT false,
  	\`seo_og_image_id\` integer,
  	\`seo_sitemap_change_frequency\` text,
  	\`seo_sitemap_priority\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`profile_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`authors_slug_idx\` ON \`authors\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`authors_profile_idx\` ON \`authors\` (\`profile_id\`);`)
  await db.run(sql`CREATE INDEX \`authors_seo_seo_og_image_idx\` ON \`authors\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`authors_updated_at_idx\` ON \`authors\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`authors_created_at_idx\` ON \`authors\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`categories\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`categories_slug_idx\` ON \`categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`categories_updated_at_idx\` ON \`categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`categories_created_at_idx\` ON \`categories\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`posts_tags\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tag\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_tags_order_idx\` ON \`posts_tags\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`posts_tags_parent_id_idx\` ON \`posts_tags\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`posts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`author_id\` integer,
  	\`published_at\` text,
  	\`content\` text,
  	\`legacy_content\` text,
  	\`excerpt\` text,
  	\`seo_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_canonical_url\` text,
  	\`seo_no_index\` integer DEFAULT false,
  	\`seo_no_follow\` integer DEFAULT false,
  	\`seo_og_image_id\` integer,
  	\`seo_sitemap_change_frequency\` text,
  	\`seo_sitemap_priority\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`authors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_slug_idx\` ON \`posts\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`posts_author_idx\` ON \`posts\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_seo_seo_og_image_idx\` ON \`posts\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_updated_at_idx\` ON \`posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_created_at_idx\` ON \`posts\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`posts_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`categories_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_rels_order_idx\` ON \`posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_parent_idx\` ON \`posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_path_idx\` ON \`posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_categories_id_idx\` ON \`posts_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE TABLE \`culture_posts_tags\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tag\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`culture_posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`culture_posts_tags_order_idx\` ON \`culture_posts_tags\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`culture_posts_tags_parent_id_idx\` ON \`culture_posts_tags\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`culture_posts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`published_at\` text,
  	\`content\` text,
  	\`legacy_content\` text,
  	\`excerpt\` text,
  	\`seo_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_canonical_url\` text,
  	\`seo_no_index\` integer DEFAULT false,
  	\`seo_no_follow\` integer DEFAULT false,
  	\`seo_og_image_id\` integer,
  	\`seo_sitemap_change_frequency\` text,
  	\`seo_sitemap_priority\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`seo_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`culture_posts_slug_idx\` ON \`culture_posts\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`culture_posts_seo_seo_og_image_idx\` ON \`culture_posts\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`culture_posts_updated_at_idx\` ON \`culture_posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`culture_posts_created_at_idx\` ON \`culture_posts\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`culture_posts_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`categories_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`culture_posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`culture_posts_rels_order_idx\` ON \`culture_posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`culture_posts_rels_parent_idx\` ON \`culture_posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`culture_posts_rels_path_idx\` ON \`culture_posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`culture_posts_rels_categories_id_idx\` ON \`culture_posts_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE TABLE \`inquiries\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`email\` text NOT NULL,
  	\`phone\` text,
  	\`company\` text,
  	\`website\` text,
  	\`subject\` text,
  	\`message\` text NOT NULL,
  	\`source_ip\` text,
  	\`status\` text DEFAULT 'new' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`inquiries_updated_at_idx\` ON \`inquiries\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`inquiries_created_at_idx\` ON \`inquiries\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`authors_id\` integer REFERENCES authors(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`categories_id\` integer REFERENCES categories(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`posts_id\` integer REFERENCES posts(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`culture_posts_id\` integer REFERENCES culture_posts(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`inquiries_id\` integer REFERENCES inquiries(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_authors_id_idx\` ON \`payload_locked_documents_rels\` (\`authors_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_culture_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`culture_posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_inquiries_id_idx\` ON \`payload_locked_documents_rels\` (\`inquiries_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`authors\`;`)
  await db.run(sql`DROP TABLE \`categories\`;`)
  await db.run(sql`DROP TABLE \`posts_tags\`;`)
  await db.run(sql`DROP TABLE \`posts\`;`)
  await db.run(sql`DROP TABLE \`posts_rels\`;`)
  await db.run(sql`DROP TABLE \`culture_posts_tags\`;`)
  await db.run(sql`DROP TABLE \`culture_posts\`;`)
  await db.run(sql`DROP TABLE \`culture_posts_rels\`;`)
  await db.run(sql`DROP TABLE \`inquiries\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
}
