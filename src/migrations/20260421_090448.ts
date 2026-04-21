import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_authors\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`profile_id\` integer,
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
  await db.run(sql`INSERT INTO \`__new_authors\`("id", "name", "slug", "status", "profile_id", "linkedin_url", "description", "legacy_description", "seo_title", "seo_meta_description", "seo_canonical_url", "seo_no_index", "seo_no_follow", "seo_og_image_id", "seo_sitemap_change_frequency", "seo_sitemap_priority", "updated_at", "created_at") SELECT "id", "name", "slug", "status", "profile_id", "linkedin_url", "description", "legacy_description", "seo_title", "seo_meta_description", "seo_canonical_url", "seo_no_index", "seo_no_follow", "seo_og_image_id", "seo_sitemap_change_frequency", "seo_sitemap_priority", "updated_at", "created_at" FROM \`authors\`;`)
  await db.run(sql`DROP TABLE \`authors\`;`)
  await db.run(sql`ALTER TABLE \`__new_authors\` RENAME TO \`authors\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`authors_slug_idx\` ON \`authors\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`authors_profile_idx\` ON \`authors\` (\`profile_id\`);`)
  await db.run(sql`CREATE INDEX \`authors_seo_seo_og_image_idx\` ON \`authors\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`authors_updated_at_idx\` ON \`authors\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`authors_created_at_idx\` ON \`authors\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_authors\` (
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
  await db.run(sql`INSERT INTO \`__new_authors\`("id", "name", "slug", "status", "profile_id", "linkedin_url", "description", "legacy_description", "seo_title", "seo_meta_description", "seo_canonical_url", "seo_no_index", "seo_no_follow", "seo_og_image_id", "seo_sitemap_change_frequency", "seo_sitemap_priority", "updated_at", "created_at") SELECT "id", "name", "slug", "status", "profile_id", "linkedin_url", "description", "legacy_description", "seo_title", "seo_meta_description", "seo_canonical_url", "seo_no_index", "seo_no_follow", "seo_og_image_id", "seo_sitemap_change_frequency", "seo_sitemap_priority", "updated_at", "created_at" FROM \`authors\`;`)
  await db.run(sql`DROP TABLE \`authors\`;`)
  await db.run(sql`ALTER TABLE \`__new_authors\` RENAME TO \`authors\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`authors_slug_idx\` ON \`authors\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`authors_profile_idx\` ON \`authors\` (\`profile_id\`);`)
  await db.run(sql`CREATE INDEX \`authors_seo_seo_og_image_idx\` ON \`authors\` (\`seo_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`authors_updated_at_idx\` ON \`authors\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`authors_created_at_idx\` ON \`authors\` (\`created_at\`);`)
}
