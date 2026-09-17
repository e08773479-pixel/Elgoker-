-- Malak Social / Supabase schema
create extension if not exists pgcrypto;

create table if not exists profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'عضو جديد',
  username text unique,
  avatar_url text,
  bio text default '',
  is_online boolean not null default false,
  last_seen timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists posts(
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  body text default '',
  media_url text,
  media_type text check(media_type in ('image','video') or media_type is null),
  visibility text not null default 'public' check(visibility in ('public','friends')),
  created_at timestamptz not null default now()
);

create table if not exists likes(
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table if not exists comments(
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists shares(
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists follows(
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check(follower_id<>following_id)
);

create table if not exists stories(
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null check(media_type in ('image','video')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours')
);

create table if not exists conversations(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists conversation_members(
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists messages(
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists groups(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  description text default '',
  cover_url text,
  created_at timestamptz not null default now()
);

create table if not exists group_members(
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key(group_id,user_id)
);

create table if not exists notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type text not null,
  post_id uuid references posts(id) on delete cascade,
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- New users automatically receive a profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Enable RLS
alter table profiles enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table shares enable row level security;
alter table follows enable row level security;
alter table stories enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table notifications enable row level security;

-- Profiles
create policy "profiles readable" on profiles for select to authenticated using (true);
create policy "own profile update" on profiles for update to authenticated using (id=auth.uid()) with check(id=auth.uid());
create policy "own profile insert" on profiles for insert to authenticated with check(id=auth.uid());

-- Posts
create policy "public posts readable" on posts for select to authenticated using (visibility='public' or author_id=auth.uid());
create policy "posts insert own" on posts for insert to authenticated with check(author_id=auth.uid());
create policy "posts update own" on posts for update to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
create policy "posts delete own" on posts for delete to authenticated using(author_id=auth.uid());

-- Reactions/content
create policy "likes readable" on likes for select to authenticated using(true);
create policy "likes own insert" on likes for insert to authenticated with check(user_id=auth.uid());
create policy "likes own delete" on likes for delete to authenticated using(user_id=auth.uid());
create policy "comments readable" on comments for select to authenticated using(true);
create policy "comments own insert" on comments for insert to authenticated with check(user_id=auth.uid());
create policy "comments own delete" on comments for delete to authenticated using(user_id=auth.uid());
create policy "shares readable" on shares for select to authenticated using(true);
create policy "shares own insert" on shares for insert to authenticated with check(user_id=auth.uid());

-- Follows
create policy "follows readable" on follows for select to authenticated using(true);
create policy "follows own insert" on follows for insert to authenticated with check(follower_id=auth.uid());
create policy "follows own delete" on follows for delete to authenticated using(follower_id=auth.uid());

-- Stories
create policy "stories readable" on stories for select to authenticated using(expires_at>now());
create policy "stories own insert" on stories for insert to authenticated with check(author_id=auth.uid());
create policy "stories own delete" on stories for delete to authenticated using(author_id=auth.uid());

-- Conversations/messages: membership controls access
create policy "conversation member read" on conversations for select to authenticated using(exists(select 1 from conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()));
create policy "conversation create" on conversations for insert to authenticated with check(true);
create policy "members read" on conversation_members for select to authenticated using(exists(select 1 from conversation_members me where me.conversation_id=conversation_id and me.user_id=auth.uid()));
create policy "members insert" on conversation_members for insert to authenticated with check(user_id=auth.uid());
create policy "messages read" on messages for select to authenticated using(exists(select 1 from conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy "messages insert" on messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));

-- Groups
create policy "groups readable" on groups for select to authenticated using(true);
create policy "groups owner insert" on groups for insert to authenticated with check(owner_id=auth.uid());
create policy "group members readable" on group_members for select to authenticated using(true);
create policy "group members own insert" on group_members for insert to authenticated with check(user_id=auth.uid());

-- Notifications
create policy "own notifications" on notifications for select to authenticated using(user_id=auth.uid());
create policy "own notifications update" on notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Storage bucket for images/videos.
insert into storage.buckets(id,name,public) values('media','media',true)
on conflict(id) do update set public=true;

create policy "media public read" on storage.objects for select using(bucket_id='media');
create policy "media authenticated upload" on storage.objects for insert to authenticated with check(bucket_id='media' and (storage.foldername(name))[1]=auth.uid()::text or bucket_id='media' and (storage.foldername(name))[1]='stories');
create policy "media owner delete" on storage.objects for delete to authenticated using(bucket_id='media' and owner_id=auth.uid());

-- Realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table likes;
alter publication supabase_realtime add table posts;
