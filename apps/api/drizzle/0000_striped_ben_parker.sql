CREATE TABLE "saved_scenario_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scenario_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"client_version_id" varchar(100) NOT NULL,
	"parent_client_version_id" varchar(100),
	"name" varchar(40) NOT NULL,
	"source" varchar(20) NOT NULL,
	"player_ids" jsonb NOT NULL,
	"intent" jsonb,
	"repair" jsonb,
	"analysis" jsonb NOT NULL,
	"data_version" varchar(160) NOT NULL,
	"scoring_version" varchar(80) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_scenarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_key" varchar(64) NOT NULL,
	"name" varchar(80) NOT NULL,
	"team_id" varchar(100) NOT NULL,
	"selected_player_ids" jsonb NOT NULL,
	"active_parent_client_version_id" varchar(100),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_scenario_versions" ADD CONSTRAINT "saved_scenario_versions_scenario_id_saved_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."saved_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_scenario_versions_client_id_idx" ON "saved_scenario_versions" USING btree ("scenario_id","client_version_id");--> statement-breakpoint
CREATE INDEX "saved_scenario_versions_scenario_ordinal_idx" ON "saved_scenario_versions" USING btree ("scenario_id","ordinal");--> statement-breakpoint
CREATE INDEX "saved_scenarios_owner_updated_idx" ON "saved_scenarios" USING btree ("owner_key","updated_at");