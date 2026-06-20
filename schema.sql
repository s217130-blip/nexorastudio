create table if not exists users (
  id text primary key,
  email text not null unique,
  created_at text not null default (datetime('now'))
);

create table if not exists study_plans (
  id text primary key,
  user_id text not null,
  target_score integer not null default 750,
  exam_date text,
  daily_minutes integer not null default 30,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists tasks (
  id text primary key,
  user_id text not null,
  title text not null,
  category text not null default 'general',
  due_date text,
  completed_at text,
  created_at text not null default (datetime('now'))
);

create table if not exists dictionary_logs (
  id text primary key,
  user_id text,
  word text not null,
  source text not null default 'groq',
  created_at text not null default (datetime('now'))
);

create table if not exists vocabulary_items (
  id text primary key,
  user_id text not null,
  word text not null,
  meaning text,
  toeic_freq text,
  created_at text not null default (datetime('now')),
  unique(user_id, word)
);

create table if not exists quiz_attempts (
  id text primary key,
  user_id text not null,
  question_id text,
  answer text,
  correct integer not null default 0,
  skill text,
  created_at text not null default (datetime('now'))
);

create table if not exists assistant_notes (
  id text primary key,
  user_id text not null,
  message text not null,
  reply text not null,
  created_at text not null default (datetime('now'))
);
