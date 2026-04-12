-- 메뉴별 리뷰 평가 결과 저장 컬럼 추가
-- Supabase 대시보드 > SQL Editor 에서 1회 실행하세요.

alter table jobs
  add column if not exists menu_evaluation jsonb;

comment on column jobs.menu_evaluation is
  '메뉴별 리뷰 기반 평가. { items: [{ menu, strengths, weaknesses, needsImprovement, improvementSuggestion }], meta }';
