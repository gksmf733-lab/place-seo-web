# scripts/

프로덕션 Next.js 앱에서 사용하지 않는 레거시/보조 스크립트를 보관합니다.

## `python/`

Phase 0~0.5에서 만든 Python CLI 스크래퍼. `lib/scraper/`가 완성되기 전까지 참조용으로 유지합니다. 프로덕션 파이프라인에서는 호출하지 않습니다.

### 실행 (필요 시)
```bash
cd scripts/python
uv sync
uv run main.py <네이버 플레이스 URL>
```

### 정본 위치
- 섹션 프롬프트 템플릿의 정본: `../../data/sections/*.yaml`
  (`scripts/python/sections/`는 원본 사본이며 편집하지 마세요)
- 스크래퍼 로직의 정본: `../../lib/scraper/`
  (Phase 6에서 TypeScript로 포팅됨)
