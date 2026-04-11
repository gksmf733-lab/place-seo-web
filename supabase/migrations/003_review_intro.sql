-- 리뷰 기반 상세설명(업체 소개글) 저장 컬럼 추가
-- Supabase 대시보드 > SQL Editor 에서 1회 실행하세요.

alter table jobs
  add column if not exists review_intro jsonb;

comment on column jobs.review_intro is
  '리뷰 기반 생성된 업체 소개글. { text, promptId, promptName, generatedAt, model }';
