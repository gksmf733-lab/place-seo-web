-- 000_jobs.sql: jobs 테이블 생성 (다른 마이그레이션의 기반 테이블)

create table if not exists public.jobs (
  id              text primary key,
  url             text not null,
  place_name      text not null,
  contact         text not null,
  memo            text,
  scrape_status   text not null default 'pending'
                    check (scrape_status in ('pending', 'processing', 'done', 'failed')),
  place_id        text,
  scrape_error    text,
  scrape_started_at  timestamptz,
  scrape_finished_at timestamptz,
  created_at      timestamptz not null default now(),
  scraped_data    jsonb,
  reviews_data    jsonb,
  worksheet_markdown text,
  canvas_pulled_at   timestamptz
);

-- 인덱스
create index if not exists idx_jobs_scrape_status on public.jobs (scrape_status);
create index if not exists idx_jobs_created_at on public.jobs (created_at desc);
create index if not exists idx_jobs_place_id on public.jobs (place_id) where place_id is not null;
create index if not exists idx_jobs_canvas_pull on public.jobs (scrape_status, canvas_pulled_at)
  where scrape_status = 'done' and canvas_pulled_at is null;
