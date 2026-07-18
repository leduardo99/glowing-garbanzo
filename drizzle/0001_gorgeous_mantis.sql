CREATE TYPE "public"."itinerary_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."itinerary_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."stop_category" AS ENUM('attraction', 'food', 'lodging', 'transport', 'other');--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY NOT NULL,
	"itinerary_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite" (
	"user_id" text NOT NULL,
	"itinerary_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_user_id_itinerary_id_pk" PRIMARY KEY("user_id","itinerary_id")
);
--> statement-breakpoint
CREATE TABLE "itinerary" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"destination" text,
	"tags" text[],
	"cover_image_url" text,
	"status" "itinerary_status" DEFAULT 'draft' NOT NULL,
	"visibility" "itinerary_visibility" DEFAULT 'public' NOT NULL,
	"invite_token" text,
	"forked_from_id" text,
	"rating_avg" numeric,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "itinerary_day" (
	"id" text PRIMARY KEY NOT NULL,
	"itinerary_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"title" text,
	"note" text,
	CONSTRAINT "itinerary_day_itinerary_id_day_number_unique" UNIQUE("itinerary_id","day_number")
);
--> statement-breakpoint
CREATE TABLE "itinerary_member" (
	"itinerary_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_member_itinerary_id_user_id_pk" PRIMARY KEY("itinerary_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rating" (
	"user_id" text NOT NULL,
	"itinerary_id" text NOT NULL,
	"stars" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rating_user_id_itinerary_id_pk" PRIMARY KEY("user_id","itinerary_id")
);
--> statement-breakpoint
CREATE TABLE "stop" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"category" "stop_category" NOT NULL,
	"description" text,
	"cost_cents" integer,
	"lat" double precision,
	"lng" double precision,
	"place_label" text
);
--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_itinerary_id_itinerary_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itinerary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_itinerary_id_itinerary_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itinerary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary" ADD CONSTRAINT "itinerary_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary" ADD CONSTRAINT "itinerary_forked_from_id_itinerary_id_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."itinerary"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_day" ADD CONSTRAINT "itinerary_day_itinerary_id_itinerary_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itinerary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_member" ADD CONSTRAINT "itinerary_member_itinerary_id_itinerary_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itinerary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_member" ADD CONSTRAINT "itinerary_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_itinerary_id_itinerary_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itinerary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop" ADD CONSTRAINT "stop_day_id_itinerary_day_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."itinerary_day"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "itinerary_status_visibility_idx" ON "itinerary" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "stop_day_id_position_idx" ON "stop" USING btree ("day_id","position");