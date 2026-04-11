-- 프롬프트 라이브러리 테이블
-- Supabase 대시보드 > SQL Editor 에서 1회 실행하세요.

create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  section_type text not null,
  name text not null,
  description text default '',
  guide text default '',
  prompt_template text not null,
  is_default boolean default false,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists prompts_section_type_idx on prompts(section_type);
create index if not exists prompts_sort_order_idx on prompts(sort_order);

-- updated_at 자동 갱신
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists prompts_set_updated_at on prompts;
create trigger prompts_set_updated_at
  before update on prompts
  for each row execute function set_updated_at();
