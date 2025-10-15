-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE auth.audit_log_entries (
  instance_id uuid,
  id uuid NOT NULL,
  payload json,
  created_at timestamp with time zone,
  ip_address character varying NOT NULL DEFAULT ''::character varying,
  CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.flow_state (
  id uuid NOT NULL,
  user_id uuid,
  auth_code text NOT NULL,
  code_challenge_method USER-DEFINED NOT NULL,
  code_challenge text NOT NULL,
  provider_type text NOT NULL,
  provider_access_token text,
  provider_refresh_token text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  authentication_method text NOT NULL,
  auth_code_issued_at timestamp with time zone,
  CONSTRAINT flow_state_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email text DEFAULT lower((identity_data ->> 'email'::text)),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT identities_pkey PRIMARY KEY (id),
  CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE auth.instances (
  id uuid NOT NULL,
  uuid uuid,
  raw_base_config text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT instances_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.mfa_amr_claims (
  session_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  authentication_method text NOT NULL,
  id uuid NOT NULL,
  CONSTRAINT mfa_amr_claims_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id)
);
CREATE TABLE auth.mfa_challenges (
  id uuid NOT NULL,
  factor_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  ip_address inet NOT NULL,
  otp_code text,
  web_authn_session_data jsonb,
  CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id)
);
CREATE TABLE auth.mfa_factors (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  friendly_name text,
  factor_type USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  secret text,
  phone text,
  last_challenged_at timestamp with time zone UNIQUE,
  web_authn_credential jsonb,
  web_authn_aaguid uuid,
  CONSTRAINT mfa_factors_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE auth.oauth_clients (
  id uuid NOT NULL,
  client_id text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  registration_type USER-DEFINED NOT NULL,
  redirect_uris text NOT NULL,
  grant_types text NOT NULL,
  client_name text CHECK (char_length(client_name) <= 1024),
  client_uri text CHECK (char_length(client_uri) <= 2048),
  logo_uri text CHECK (char_length(logo_uri) <= 2048),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT oauth_clients_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.one_time_tokens (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_type USER-DEFINED NOT NULL,
  token_hash text NOT NULL CHECK (char_length(token_hash) > 0),
  relates_to text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE auth.refresh_tokens (
  instance_id uuid,
  id bigint NOT NULL DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass),
  token character varying UNIQUE,
  user_id character varying,
  revoked boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  parent character varying,
  session_id uuid,
  CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id)
);
CREATE TABLE auth.saml_providers (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  entity_id text NOT NULL UNIQUE CHECK (char_length(entity_id) > 0),
  metadata_xml text NOT NULL CHECK (char_length(metadata_xml) > 0),
  metadata_url text CHECK (metadata_url = NULL::text OR char_length(metadata_url) > 0),
  attribute_mapping jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  name_id_format text,
  CONSTRAINT saml_providers_pkey PRIMARY KEY (id),
  CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id)
);
CREATE TABLE auth.saml_relay_states (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  request_id text NOT NULL CHECK (char_length(request_id) > 0),
  for_email text,
  redirect_to text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  flow_state_id uuid,
  CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id),
  CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id),
  CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id)
);
CREATE TABLE auth.schema_migrations (
  version character varying NOT NULL,
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);
CREATE TABLE auth.sessions (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  factor_id uuid,
  aal USER-DEFINED,
  not_after timestamp with time zone,
  refreshed_at timestamp without time zone,
  user_agent text,
  ip inet,
  tag text,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE auth.sso_domains (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  domain text NOT NULL CHECK (char_length(domain) > 0),
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT sso_domains_pkey PRIMARY KEY (id),
  CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id)
);
CREATE TABLE auth.sso_providers (
  id uuid NOT NULL,
  resource_id text CHECK (resource_id = NULL::text OR char_length(resource_id) > 0),
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  disabled boolean,
  CONSTRAINT sso_providers_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.users (
  instance_id uuid,
  id uuid NOT NULL,
  aud character varying,
  role character varying,
  email character varying,
  encrypted_password character varying,
  email_confirmed_at timestamp with time zone,
  invited_at timestamp with time zone,
  confirmation_token character varying,
  confirmation_sent_at timestamp with time zone,
  recovery_token character varying,
  recovery_sent_at timestamp with time zone,
  email_change_token_new character varying,
  email_change character varying,
  email_change_sent_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  phone text DEFAULT NULL::character varying UNIQUE,
  phone_confirmed_at timestamp with time zone,
  phone_change text DEFAULT ''::character varying,
  phone_change_token character varying DEFAULT ''::character varying,
  phone_change_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone DEFAULT LEAST(email_confirmed_at, phone_confirmed_at),
  email_change_token_current character varying DEFAULT ''::character varying,
  email_change_confirm_status smallint DEFAULT 0 CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2),
  banned_until timestamp with time zone,
  reauthentication_token character varying DEFAULT ''::character varying,
  reauthentication_sent_at timestamp with time zone,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  is_anonymous boolean NOT NULL DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE cron.job (
  jobid bigint NOT NULL DEFAULT nextval('cron.jobid_seq'::regclass),
  schedule text NOT NULL,
  command text NOT NULL,
  nodename text NOT NULL DEFAULT 'localhost'::text,
  nodeport integer NOT NULL DEFAULT inet_server_port(),
  database text NOT NULL DEFAULT current_database(),
  username text NOT NULL DEFAULT CURRENT_USER,
  active boolean NOT NULL DEFAULT true,
  jobname text,
  CONSTRAINT job_pkey PRIMARY KEY (jobid)
);
CREATE TABLE cron.job_run_details (
  jobid bigint,
  runid bigint NOT NULL DEFAULT nextval('cron.runid_seq'::regclass),
  job_pid integer,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  CONSTRAINT job_run_details_pkey PRIMARY KEY (runid)
);-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  idx integer NOT NULL,
  name text NOT NULL,
  rationale text NOT NULL,
  target_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  CONSTRAINT milestones_pkey PRIMARY KEY (id),
  CONSTRAINT milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT milestones_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id)
);
CREATE TABLE public.onboarding_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid,
  goal_text text NOT NULL,
  clarification_1 text,
  clarification_2 text,
  clarification_questions jsonb,
  start_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_responses_pkey PRIMARY KEY (id),
  CONSTRAINT onboarding_responses_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id),
  CONSTRAINT onboarding_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_text text NOT NULL,
  clarifications jsonb,
  start_date date NOT NULL,
  end_date date,
  summary_data jsonb,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id),
  CONSTRAINT plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.task_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  task_id uuid NOT NULL,
  scheduled_date date NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  milestone_id uuid,
  CONSTRAINT task_completions_pkey PRIMARY KEY (id),
  CONSTRAINT task_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT task_completions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id),
  CONSTRAINT task_completions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT task_completions_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id)
);
CREATE TABLE public.task_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  task_id uuid NOT NULL,
  day_index integer NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  milestone_id uuid,
  CONSTRAINT task_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT task_schedule_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT task_schedule_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id),
  CONSTRAINT task_schedule_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id),
  CONSTRAINT task_schedule_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  milestone_id uuid,
  idx integer NOT NULL,
  name text NOT NULL,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT tasks_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id),
  CONSTRAINT tasks_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id)
);-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE realtime.messages (
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  inserted_at timestamp without time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT messages_pkey PRIMARY KEY (inserted_at, id)
);
CREATE TABLE realtime.messages_2025_10_09 (
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  inserted_at timestamp without time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT messages_2025_10_09_pkey PRIMARY KEY (id, inserted_at)
);
CREATE TABLE realtime.messages_2025_10_10 (
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  inserted_at timestamp without time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT messages_2025_10_10_pkey PRIMARY KEY (inserted_at, id)
);
CREATE TABLE realtime.messages_2025_10_11 (
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  inserted_at timestamp without time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT messages_2025_10_11_pkey PRIMARY KEY (inserted_at, id)
);
CREATE TABLE realtime.messages_2025_10_12 (
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  inserted_at timestamp without time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT messages_2025_10_12_pkey PRIMARY KEY (inserted_at, id)
);
CREATE TABLE realtime.messages_2025_10_13 (
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  inserted_at timestamp without time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT messages_2025_10_13_pkey PRIMARY KEY (inserted_at, id)
);
CREATE TABLE realtime.messages_2025_10_14 (
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  inserted_at timestamp without time zone NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT messages_2025_10_14_pkey PRIMARY KEY (inserted_at, id)
);
CREATE TABLE realtime.schema_migrations (
  version bigint NOT NULL,
  inserted_at timestamp without time zone,
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);
CREATE TABLE realtime.subscription (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  subscription_id uuid NOT NULL,
  entity regclass NOT NULL,
  filters ARRAY NOT NULL DEFAULT '{}'::realtime.user_defined_filter[],
  claims jsonb NOT NULL,
  claims_role regrole NOT NULL DEFAULT realtime.to_regrole((claims ->> 'role'::text)),
  created_at timestamp without time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subscription_pkey PRIMARY KEY (id)
);-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE storage.buckets (
  id text NOT NULL,
  name text NOT NULL,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types ARRAY,
  owner_id text,
  type USER-DEFINED NOT NULL DEFAULT 'STANDARD'::storage.buckettype,
  CONSTRAINT buckets_pkey PRIMARY KEY (id)
);
CREATE TABLE storage.buckets_analytics (
  id text NOT NULL,
  type USER-DEFINED NOT NULL DEFAULT 'ANALYTICS'::storage.buckettype,
  format text NOT NULL DEFAULT 'ICEBERG'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id)
);
CREATE TABLE storage.migrations (
  id integer NOT NULL,
  name character varying NOT NULL UNIQUE,
  hash character varying NOT NULL,
  executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE storage.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  path_tokens ARRAY DEFAULT string_to_array(name, '/'::text),
  version text,
  owner_id text,
  user_metadata jsonb,
  level integer,
  CONSTRAINT objects_pkey PRIMARY KEY (id),
  CONSTRAINT objects_bucketId_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)
);
CREATE TABLE storage.prefixes (
  bucket_id text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL DEFAULT storage.get_level(name),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prefixes_pkey PRIMARY KEY (level, name, bucket_id),
  CONSTRAINT prefixes_bucketId_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)
);
CREATE TABLE storage.s3_multipart_uploads (
  id text NOT NULL,
  in_progress_size bigint NOT NULL DEFAULT 0,
  upload_signature text NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  version text NOT NULL,
  owner_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_metadata jsonb,
  CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)
);
CREATE TABLE storage.s3_multipart_uploads_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  upload_id text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  part_number integer NOT NULL,
  bucket_id text NOT NULL,
  key text NOT NULL,
  etag text NOT NULL,
  owner_id text,
  version text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id),
  CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id),
  CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)
);-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE supabase_migrations.schema_migrations (
  version text NOT NULL,
  statements ARRAY,
  name text,
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);
CREATE TABLE supabase_migrations.seed_files (
  path text NOT NULL,
  hash text NOT NULL,
  CONSTRAINT seed_files_pkey PRIMARY KEY (path)
);-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE vault.secrets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  description text NOT NULL DEFAULT ''::text,
  secret text NOT NULL,
  key_id uuid,
  nonce bytea DEFAULT vault._crypto_aead_det_noncegen(),
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT secrets_pkey PRIMARY KEY (id)
);