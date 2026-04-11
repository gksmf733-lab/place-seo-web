-- 사장님 톤 업체 소개글 저장 컬럼 추가
-- Supabase 대시보드 > SQL Editor 에서 1회 실행하세요.

alter table jobs
  add column if not exists owner_intro jsonb;

comment on column jobs.owner_intro is
  '자신있는 사장님 톤으로 생성된 업체 소개글. { text, generatedAt, model }';
