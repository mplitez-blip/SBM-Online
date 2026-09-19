CREATE TABLE "assessment_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_year_id" integer NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"rating_label_1" text DEFAULT 'Level 1: Developing' NOT NULL,
	"rating_label_2" text DEFAULT 'Level 2: Maturing' NOT NULL,
	"rating_label_3" text DEFAULT 'Level 3: Advanced' NOT NULL,
	"rating_label_4" text DEFAULT 'Level 4: Exemplary' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"allow_edit_after_submission" boolean DEFAULT false NOT NULL,
	"require_all_indicators" boolean DEFAULT true NOT NULL,
	"require_global_remarks" boolean DEFAULT false NOT NULL,
	"require_indicator_remarks" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "assessment_forms_school_year_id_unique" UNIQUE("school_year_id")
);
--> statement-breakpoint
CREATE TABLE "assessment_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"indicator_id" integer NOT NULL,
	"rating" integer DEFAULT 0 NOT NULL,
	"remarks" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"school_year_id" integer NOT NULL,
	"status" text DEFAULT 'Not started' NOT NULL,
	"submitted_at" timestamp,
	"submitted_by_name" text,
	"global_remarks" text,
	"calculated_average" text DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"username" text,
	"role" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"details" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"division_code" text NOT NULL,
	"division_name" text NOT NULL,
	"logo" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "divisions_division_code_unique" UNIQUE("division_code")
);
--> statement-breakpoint
CREATE TABLE "footer_customization" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_wide_logo" text,
	"logo_2" text,
	"logo_3" text,
	"footer_text" text NOT NULL,
	"support_email" text DEFAULT 'qad.region8@deped.gov.ph' NOT NULL,
	"telephone" text DEFAULT '(053) 832-2997' NOT NULL,
	"data_privacy_url" text DEFAULT '#' NOT NULL,
	"terms_url" text DEFAULT '#' NOT NULL,
	"user_manual_url" text DEFAULT '#' NOT NULL,
	"facebook_url" text DEFAULT 'https://www.facebook.com/DepEdROVIII' NOT NULL,
	"website_url" text DEFAULT 'https://region8.deped.gov.ph' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_indicators" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"code" text NOT NULL,
	"content" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"title" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_customization" (
	"id" serial PRIMARY KEY NOT NULL,
	"eyebrow_text" text DEFAULT 'DEPARTMENT OF EDUCATION - REGIONAL OFFICE VIII' NOT NULL,
	"main_heading" text DEFAULT 'Project SBM Online' NOT NULL,
	"description" text DEFAULT 'A centralized School-Based Management Self-Assessment, Monitoring, Administration, and Reporting System for Eastern Visayas.' NOT NULL,
	"login_form_title" text DEFAULT 'Sign In to SBM Portal' NOT NULL,
	"login_form_description" text DEFAULT 'Enter your DepEd regional, division, or school credentials to access the system.' NOT NULL,
	"public_announcement" text DEFAULT 'Official SBM self-assessment portal for Regional Office VIII. Validated data serves as the basis for school technical assistance and quality assurance.' NOT NULL,
	"login_logo" text,
	"brand_panel_bg" text,
	"primary_color" text DEFAULT '#0d6efd' NOT NULL,
	"gradient_color" text DEFAULT '#0a58ca' NOT NULL,
	"accent_color" text DEFAULT '#ffc107' NOT NULL,
	"login_panel_color" text DEFAULT '#ffffff' NOT NULL,
	"show_full_footer" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "school_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "school_classifications_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "school_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "school_years_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"school_name" text NOT NULL,
	"division_id" integer NOT NULL,
	"district" text NOT NULL,
	"classification" text NOT NULL,
	"school_head" text NOT NULL,
	"logo" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "schools_school_id_unique" UNIQUE("school_id")
);
--> statement-breakpoint
CREATE TABLE "system_customization" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_title" text DEFAULT 'Project SBM Online' NOT NULL,
	"region_title" text DEFAULT 'Department of Education Regional Office VIII' NOT NULL,
	"navbar_logo" text,
	"region_logo" text,
	"favicon" text,
	"base_font_size" integer DEFAULT 15 NOT NULL,
	"primary_color" text DEFAULT '#0d6efd' NOT NULL,
	"secondary_color" text DEFAULT '#495057' NOT NULL,
	"accent_color" text DEFAULT '#ffc107' NOT NULL,
	"background_color" text DEFAULT '#f8f9fa' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"division_id" integer,
	"school_id" integer,
	"full_name" text NOT NULL,
	"logo" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"lockout_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "assessment_forms" ADD CONSTRAINT "assessment_forms_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_indicator_id_form_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."form_indicators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_indicators" ADD CONSTRAINT "form_indicators_form_id_assessment_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."assessment_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_indicators" ADD CONSTRAINT "form_indicators_section_id_form_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."form_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_sections" ADD CONSTRAINT "form_sections_form_id_assessment_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."assessment_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "responses_assessment_indicator_idx" ON "assessment_responses" USING btree ("assessment_id","indicator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_school_year_idx" ON "assessments" USING btree ("school_id","school_year_id");