-- 부가서비스 정찰 결과 저장 컬럼 추가
-- Supabase 대시보드 > SQL Editor 에서 1회 실행하세요.

alter table jobs
  add column if not exists probe_data jsonb;

comment on column jobs.probe_data is
  '부가서비스 정찰 결과. { placeId, homeUrl, generatedAt, features[] }';
