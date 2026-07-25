-- New accounts start with the same dark midnight theme as the public screens.
-- Existing users keep their explicit preference.
alter table public.user_settings alter column dark set default true;
