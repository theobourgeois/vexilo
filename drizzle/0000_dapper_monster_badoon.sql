CREATE TABLE "vexilo_account" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "vexilo_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "vexilo_flag_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"flag" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vexilo_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"image" varchar(1000) NOT NULL,
	"link" varchar(1000) NOT NULL,
	"index" integer NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vexilo_session" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vexilo_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp (3) DEFAULT CURRENT_TIMESTAMP(3),
	"image" varchar(255),
	"hashed_password" text
);
--> statement-breakpoint
CREATE TABLE "vexilo_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "vexilo_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "vexilo_account" ADD CONSTRAINT "vexilo_account_user_id_vexilo_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."vexilo_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vexilo_flag_request" ADD CONSTRAINT "vexilo_flag_request_user_id_vexilo_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."vexilo_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vexilo_session" ADD CONSTRAINT "vexilo_session_user_id_vexilo_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."vexilo_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "vexilo_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "index_unique" ON "vexilo_flag" USING btree ("index");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "vexilo_session" USING btree ("user_id");