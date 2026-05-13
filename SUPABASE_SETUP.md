# Supabase storage setup

The app can store data in either `localStorage` or Supabase. The switch is controlled by:

```env
VITE_STORAGE_DRIVER=localStorage
```

or:

```env
VITE_STORAGE_DRIVER=supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Database table

In Supabase SQL editor, create one document-style table:

```sql
create table if not exists public.app_storage (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_app_storage_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_storage_updated_at on public.app_storage;

create trigger app_storage_updated_at
before update on public.app_storage
for each row
execute function public.touch_app_storage_updated_at();
```

## RLS policy for coursework/local testing

For local development, you can keep this table open to the anon key:

```sql
alter table public.app_storage enable row level security;

drop policy if exists "allow app storage read" on public.app_storage;
drop policy if exists "allow app storage write" on public.app_storage;

create policy "allow app storage read"
on public.app_storage
for select
to anon
using (true);

create policy "allow app storage write"
on public.app_storage
for all
to anon
using (true)
with check (true);
```

For production, replace these policies with authenticated-user policies.

## Switching storage

After changing `.env`, restart Vite:

```bash
npm run dev
```
