-- review_intro 섹션의 기본 프롬프트 1건 시드
-- Supabase 대시보드 > SQL Editor 에서 1회 실행하세요.
--
-- 이 섹션의 프롬프트는 "작성 가이드(스타일/톤/분량 지시)"만 담으면 됩니다.
-- 리뷰 분석 결과(요약·강점·키워드·페르소나·원본리뷰)는 자동으로 컨텍스트에
-- 주입되므로 템플릿에 {placeholder} 를 쓸 필요가 없습니다.
-- guide 필드 = LLM에 전달되는 실제 지시문.
-- prompt_template 은 레거시 호환을 위해 동일값으로 보관.

insert into prompts (
  section_type,
  name,
  description,
  guide,
  prompt_template,
  is_default,
  sort_order
)
select
  'review_intro',
  '리뷰 기반 상세설명 - 기본',
  '리뷰 분석 결과를 바탕으로 자연스러운 업체 소개글을 작성합니다. 가이드/톤 지시만 입력하세요.',
  E'- 한국어 서술형, 공백 포함 500~1000자 분량 (필수)\n- 리뷰에서 반복되는 강점(분위기·메뉴·서비스)을 구체적으로 녹일 것\n- 페르소나(주요 방문객)가 느끼는 가치를 자연스럽게 반영\n- 감정적 과장·추측·허위 금지\n- 머리말·해시태그 없이 본문만 출력',
  E'- 한국어 서술형, 공백 포함 500~1000자 분량 (필수)\n- 리뷰에서 반복되는 강점(분위기·메뉴·서비스)을 구체적으로 녹일 것\n- 페르소나(주요 방문객)가 느끼는 가치를 자연스럽게 반영\n- 감정적 과장·추측·허위 금지\n- 머리말·해시태그 없이 본문만 출력',
  true,
  1
where not exists (
  select 1 from prompts where section_type = 'review_intro'
);
