-- Replica Editor — schema espelho em SQL.
-- O runtime entregue usa JSON atômico por projeto (sem native module, sem ABI por
-- plataforma). Este DDL existe para quem quiser SQLite/Postgres, e para deixar as
-- regras duras do modelo como constraint de banco, não só de validação na UI.
-- Convenções: id uuid-ish (text), created_at/updated_at timestamptz UTC,
-- tempo sempre em frames inteiros, sem float.

create table projects (
  id            text primary key,
  name          text not null,
  settings      text not null default '{}',   -- json: fps,width,height,sampleRate,proxyEnabled,proxyScale,renderPath
  active_timeline_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table media_items (
  id            text primary key,
  project_id    text not null references projects(id) on delete cascade,
  name          text not null,
  path          text not null,
  kind          text not null check (kind in ('video','audio','image')),
  duration_frames integer not null check (duration_frames > 0),
  fps           real not null check (fps > 0),
  width         integer check (width is null or width > 0),
  height        integer check (height is null or height > 0),
  has_audio     boolean not null default false,
  thumb_path    text,
  proxy_path    text,
  status        text not null default 'importing'
                  check (status in ('importing','ready','error')),
  content_hash  text not null,
  metadata      text not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on media_items (project_id);
create index on media_items (project_id, content_hash);

create table bins (
  id            text primary key,
  project_id    text not null references projects(id) on delete cascade,
  name          text not null,
  parent_id     text references bins(id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index on bins (project_id);
create index on bins (parent_id);

create table bin_items (
  bin_id        text not null references bins(id) on delete cascade,
  media_id      text not null references media_items(id) on delete cascade,
  primary key (bin_id, media_id)
);

create table timelines (
  id            text primary key,
  project_id    text not null references projects(id) on delete cascade,
  name          text not null,
  duration_frames integer not null default 0 check (duration_frames >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on timelines (project_id);

create table tracks (
  id            text primary key,
  timeline_id   text not null references timelines(id) on delete cascade,
  kind          text not null check (kind in ('video','audio')),
  idx           integer not null check (idx > 0),
  name          text not null,
  height        integer not null default 72 check (height > 0),
  muted         boolean not null default false,
  solo          boolean not null default false,
  locked        boolean not null default false,
  unique (timeline_id, kind, idx)
);
create index on tracks (timeline_id);

create table timeline_clips (
  id            text primary key,
  timeline_id   text not null references timelines(id) on delete cascade,
  track_id      text not null references tracks(id) on delete cascade,
  media_id      text not null references media_items(id) on delete cascade,
  title_id      text references titles(id) on delete cascade,
  start_frame   integer not null check (start_frame >= 0),
  in_frame      integer not null check (in_frame >= 0),
  out_frame     integer not null,
  enabled       boolean not null default true,
  transform     text not null default '{"x":0,"y":0,"scale":1,"rotation":0}',
  opacity       real not null default 1 check (opacity between 0 and 1),
  volume        real not null default 1 check (volume between 0 and 2),
  speed         real not null default 1 check (speed > 0),
  color         text not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint clip_has_length check (out_frame > in_frame)
);
create index on timeline_clips (timeline_id);
create index on timeline_clips (track_id, start_frame);

-- dois clips da mesma faixa nunca ocupam o mesmo frame
create unique index on timeline_clips (track_id, start_frame);

create table keyframes (
  id            text primary key,
  clip_id       text not null references timeline_clips(id) on delete cascade,
  property      text not null
                  check (property in ('opacity','volume','x','y','scale','rotation')),
  time_frame    integer not null check (time_frame >= 0),
  value         real not null,
  easing        text not null default 'linear'
                  check (easing in ('linear','ease-in','ease-out','ease-in-out'))
);
create index on keyframes (clip_id, property, time_frame);

create table transitions (
  id            text primary key,
  timeline_id   text not null references timelines(id) on delete cascade,
  clip_a_id     text not null references timeline_clips(id) on delete cascade,
  clip_b_id     text not null references timeline_clips(id) on delete cascade,
  kind          text not null check (kind in ('cross','dip-to-black')),
  duration_frames integer not null check (duration_frames > 0),
  position      integer not null check (position >= 0)
);
create index on transitions (timeline_id);

create table markers (
  id            text primary key,
  timeline_id   text not null references timelines(id) on delete cascade,
  time_frame    integer not null check (time_frame >= 0),
  color         text not null default '#ffcc00',
  label         text not null default ''
);
create index on markers (timeline_id, time_frame);

create table titles (
  id            text primary key,
  project_id    text not null references projects(id) on delete cascade,
  text          text not null,
  font_size     real not null default 48,
  color         text not null default '#ffffff',
  align         text not null default 'center'
                  check (align in ('left','center','right'))
);
create index on titles (project_id);

create table render_jobs (
  id            text primary key,
  project_id    text not null references projects(id) on delete cascade,
  timeline_id   text not null references timelines(id) on delete cascade,
  preset_id     text not null,
  idempotency_key text not null unique,
  status        text not null default 'queued'
                  check (status in ('queued','rendering','done','failed','cancelled')),
  progress      real not null default 0 check (progress between 0 and 1),
  output_path   text,
  error         text,
  log           text not null default '',
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on render_jobs (project_id);
create index on render_jobs (status);
