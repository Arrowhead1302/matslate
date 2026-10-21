-- =====================================================================
-- MatSlate database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a fresh project.
-- =====================================================================

-- ---------- Types ----------------------------------------------------
create type public.staff_role   as enum ('head_coach', 'assistant_coach', 'athletic_director');
create type public.approval     as enum ('pending', 'approved', 'rejected');
create type public.event_type   as enum ('dual', 'tri_dual', 'individual_tournament', 'dual_tournament');
create type public.event_gender as enum ('boys', 'girls', 'both');
create type public.entry_kind   as enum ('request', 'invite');
create type public.entry_status as enum ('pending', 'approved', 'declined', 'waitlisted', 'withdrawn');

-- ---------- Tables ---------------------------------------------------
create table public.regions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  state      text not null,               -- two-letter code, e.g. NV
  created_at timestamptz not null default now(),
  unique (name, state)
);

create table public.schools (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  short_name      text,                    -- e.g. "BA" (used when there is no logo)
  mascot          text,
  city            text,
  state           text not null default 'NV',
  region_id       uuid references public.regions(id),
  address         text,
  primary_color   text not null default '#1B2A4A',
  secondary_color text not null default '#F26B3A',
  logo_url        text,
  verified        boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  role        public.staff_role not null,
  status      public.approval not null default 'pending',
  decided_by  uuid references public.profiles(id),
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, school_id)
);

create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  host_school_id        uuid not null references public.schools(id) on delete cascade,
  created_by            uuid references public.profiles(id),
  title                 text not null,
  event_type            public.event_type not null,
  gender                public.event_gender not null,
  levels                text[] not null default '{Varsity}',
  start_date            date not null,
  end_date              date not null,
  start_time            time,
  end_time              time,
  location_name         text,
  address               text,
  max_teams             int check (max_teams is null or max_teams >= 2),
  team_fee              numeric(8,2),
  individual_fee        numeric(8,2),
  registration_deadline date,
  weigh_in_info         text,
  format_info           text,
  payment_info          text,
  spectator_info        text,
  contact_name          text,
  contact_phone         text,
  contact_email         text,
  details               text,
  flyer_url             text,
  flyer_name            text,
  cancelled             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on public.events (start_date);
create index on public.events (host_school_id);

create table public.event_entries (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  kind        public.entry_kind not null,
  status      public.entry_status not null default 'pending',
  note        text,
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_id, school_id)
);
create index on public.event_entries (school_id);

create table public.event_updates (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  author_id  uuid references public.profiles(id),
  message    text not null,
  created_at timestamptz not null default now()
);

create table public.open_dates (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  created_by  uuid references public.profiles(id),
  date        date not null,
  gender      public.event_gender not null default 'boys',
  home_away   text not null default 'either' check (home_away in ('home','away','either')),
  notes       text,
  filled      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- New sign-ins get a profile automatically -----------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Permission helpers ---------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- Approved for at least one team (or an admin)
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from memberships where user_id = auth.uid() and status = 'approved');
$$;

create or replace function public.is_member_of(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from memberships
    where user_id = auth.uid() and school_id = sid and status = 'approved');
$$;

-- Head coach or athletic director (can manage team settings and staff)
create or replace function public.is_team_manager(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from memberships
    where user_id = auth.uid() and school_id = sid and status = 'approved'
      and role in ('head_coach', 'athletic_director'));
$$;

create or replace function public.is_event_host(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = eid and public.is_member_of(e.host_school_id));
$$;

-- ---------- Row Level Security --------------------------------------
alter table public.regions       enable row level security;
alter table public.schools       enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.events        enable row level security;
alter table public.event_entries enable row level security;
alter table public.event_updates enable row level security;
alter table public.open_dates    enable row level security;

-- Regions: anyone signed in can read (needed for sign-up); admin edits
create policy "regions read"  on public.regions for select to authenticated using (true);
create policy "regions admin" on public.regions for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Schools: anyone signed in can read (needed to pick a school at sign-up)
create policy "schools read"   on public.schools for select to authenticated using (true);
create policy "schools add"    on public.schools for insert to authenticated with check (verified = false or public.is_admin());
create policy "schools edit"   on public.schools for update to authenticated using (public.is_team_manager(id)) with check (public.is_team_manager(id));
create policy "schools delete" on public.schools for delete to authenticated using (public.is_admin());
-- Only admins may flip the verified flag
revoke update on public.schools from authenticated;
grant update (name, short_name, mascot, city, state, address, primary_color, secondary_color, logo_url, region_id) on public.schools to authenticated;
create or replace function public.admin_set_school_verified(sid uuid, v boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can verify schools'; end if;
  update schools set verified = v where id = sid;
end $$;

-- Profiles: see yourself; approved coaches can see other coaches' names
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_user());
create policy "profiles edit own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Memberships: see your own, your team's, or everything if admin
create policy "memberships read" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_member_of(school_id));
create policy "memberships request" on public.memberships for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and decided_by is null);
create policy "memberships cancel own pending" on public.memberships for delete to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_team_manager(school_id));

-- Approve / reject staff.
--   Head coaches are approved by an admin.
--   Assistants and ADs are approved by their school's head coach or AD (or an admin).
create or replace function public.decide_membership(mid uuid, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships where id = mid;
  if not found then raise exception 'Request not found'; end if;
  if m.role = 'head_coach' then
    if not public.is_admin() then raise exception 'Only an admin can approve head coaches'; end if;
    if approve then update schools set verified = true where id = m.school_id; end if;
  else
    if not public.is_team_manager(m.school_id) then
      raise exception 'Only your head coach or athletic director can approve this';
    end if;
  end if;
  update memberships
     set status = case when approve then 'approved'::approval else 'rejected'::approval end,
         decided_by = auth.uid(), decided_at = now()
   where id = mid;
end $$;

-- Events: approved coaches can see all events; host staff manage their own
create policy "events read"   on public.events for select to authenticated using (public.is_active_user());
create policy "events add"    on public.events for insert to authenticated
  with check (public.is_member_of(host_school_id) and created_by = auth.uid());
create policy "events edit"   on public.events for update to authenticated
  using (public.is_member_of(host_school_id)) with check (public.is_member_of(host_school_id));
create policy "events delete" on public.events for delete to authenticated using (public.is_member_of(host_school_id));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger events_touch  before update on public.events        for each row execute function public.touch_updated_at();
create trigger entries_touch before update on public.event_entries for each row execute function public.touch_updated_at();

-- Entries: everyone approved can see who is attending.
-- All changes go through the functions below so the rules are enforced.
create policy "entries read" on public.event_entries for select to authenticated using (public.is_active_user());

create or replace function public.event_is_full(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select e.max_teams is not null and
         (1 + (select count(*) from event_entries x where x.event_id = eid and x.status = 'approved')) >= e.max_teams
  from events e where e.id = eid;
$$;

-- A team asks to attend an event (goes on the waitlist if the event is full)
create or replace function public.request_to_attend(eid uuid, sid uuid, note_text text default null)
returns event_entries language plpgsql security definer set search_path = public as $$
declare ev events; result event_entries; new_status entry_status;
begin
  if not public.is_member_of(sid) then raise exception 'You are not on that team''s staff'; end if;
  select * into ev from events where id = eid;
  if not found or ev.cancelled then raise exception 'This event is not available'; end if;
  if ev.host_school_id = sid then raise exception 'You are the host of this event'; end if;
  new_status := case when public.event_is_full(eid) then 'waitlisted' else 'pending' end;
  insert into event_entries (event_id, school_id, kind, status, note, created_by, updated_by)
  values (eid, sid, 'request', new_status, note_text, auth.uid(), auth.uid())
  on conflict (event_id, school_id) do update
     set kind = 'request', status = new_status, note = excluded.note, updated_by = auth.uid()
   where event_entries.status in ('declined', 'withdrawn')
  returning * into result;
  if result.id is null then raise exception 'Your team already has a request or invite for this event'; end if;
  return result;
end $$;

-- The host invites a team
create or replace function public.invite_team(eid uuid, sid uuid, note_text text default null)
returns event_entries language plpgsql security definer set search_path = public as $$
declare ev events; result event_entries;
begin
  select * into ev from events where id = eid;
  if not found then raise exception 'Event not found'; end if;
  if not public.is_member_of(ev.host_school_id) then raise exception 'Only the host can invite teams'; end if;
  if ev.host_school_id = sid then raise exception 'That is your own team'; end if;
  insert into event_entries (event_id, school_id, kind, status, note, created_by, updated_by)
  values (eid, sid, 'invite', 'pending', note_text, auth.uid(), auth.uid())
  on conflict (event_id, school_id) do update
     set kind = 'invite', status = 'pending', note = excluded.note, updated_by = auth.uid()
   where event_entries.status in ('declined', 'withdrawn')
  returning * into result;
  if result.id is null then raise exception 'That team already has a request or invite for this event'; end if;
  return result;
end $$;

-- Respond to an entry.
--   Host:          approve | decline | waitlist | remove   (on requests; remove works on anyone)
--   Invited team:  accept  | decline                       (on invites)
--   Attending team: withdraw
create or replace function public.respond_to_entry(entry_id uuid, action text)
returns event_entries language plpgsql security definer set search_path = public as $$
declare en event_entries; ev events; is_host boolean; is_guest boolean; result event_entries;
begin
  select * into en from event_entries where id = entry_id;
  if not found then raise exception 'Not found'; end if;
  select * into ev from events where id = en.event_id;
  is_host  := public.is_member_of(ev.host_school_id);
  is_guest := public.is_member_of(en.school_id);

  if action in ('approve', 'waitlist', 'remove') or (action = 'decline' and en.kind = 'request') then
    if not is_host then raise exception 'Only the host can do that'; end if;
  elsif action = 'accept' or (action = 'decline' and en.kind = 'invite') then
    if not is_guest then raise exception 'Only the invited team can do that'; end if;
  elsif action = 'withdraw' then
    if not is_guest then raise exception 'Only that team can withdraw'; end if;
  else
    raise exception 'Unknown action %', action;
  end if;

  if action in ('approve', 'accept') and en.status <> 'approved' and public.event_is_full(ev.id) then
    raise exception 'This event is full. Raise the team limit or remove a team first.';
  end if;

  update event_entries set
    status = case action
      when 'approve'  then 'approved'::entry_status
      when 'accept'   then 'approved'::entry_status
      when 'decline'  then 'declined'::entry_status
      when 'waitlist' then 'waitlisted'::entry_status
      when 'remove'   then 'declined'::entry_status
      when 'withdraw' then 'withdrawn'::entry_status
    end,
    updated_by = auth.uid()
  where id = entry_id
  returning * into result;
  return result;
end $$;

-- Announcements on an event (host posts, everyone approved reads)
create policy "updates read"   on public.event_updates for select to authenticated using (public.is_active_user());
create policy "updates add"    on public.event_updates for insert to authenticated
  with check (public.is_event_host(event_id) and author_id = auth.uid());
create policy "updates delete" on public.event_updates for delete to authenticated using (public.is_event_host(event_id));

-- Open dates board
create policy "open dates read"   on public.open_dates for select to authenticated using (public.is_active_user());
create policy "open dates add"    on public.open_dates for insert to authenticated
  with check (public.is_member_of(school_id) and created_by = auth.uid());
create policy "open dates edit"   on public.open_dates for update to authenticated
  using (public.is_member_of(school_id)) with check (public.is_member_of(school_id));
create policy "open dates delete" on public.open_dates for delete to authenticated using (public.is_member_of(school_id));

-- ---------- File storage (flyers and logos) --------------------------
insert into storage.buckets (id, name, public) values ('flyers', 'flyers', true), ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "upload files" on storage.objects for insert to authenticated
  with check (bucket_id in ('flyers', 'logos') and public.is_active_user());
create policy "replace own files" on storage.objects for update to authenticated
  using (bucket_id in ('flyers', 'logos') and owner = auth.uid());
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('flyers', 'logos') and (owner = auth.uid() or public.is_admin()));

-- ---------- Starting data --------------------------------------------
insert into public.regions (name, state) values ('Southern Nevada', 'NV');
