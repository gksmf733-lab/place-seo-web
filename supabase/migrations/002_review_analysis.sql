-- 리뷰 AI 분석 결과 컬럼 추가
-- Supabase 대시보드 > SQL Editor 에서 1회 실행하세요.

alter table jobs
  add column if not exists review_analysis jsonb;

comment on column jobs.review_analysis is
  '리뷰 AI 분석 결과(JSON). { summary, sentiment, keywords, strengths, improvements, persona, goldenKeywords, meta }';
