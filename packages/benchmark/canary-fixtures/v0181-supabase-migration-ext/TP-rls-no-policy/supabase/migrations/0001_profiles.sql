CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  bio text
);

-- ENABLE RLS without any CREATE POLICY → silent deny-all
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
