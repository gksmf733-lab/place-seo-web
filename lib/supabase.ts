import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // 빌드 타임(next build)에는 실제 DB 연결이 필요 없으므로 placeholder 반환
    // 런타임에 환경변수가 없으면 호출 시점에 Supabase SDK가 에러를 던짐
    console.warn(
      "[supabase] 환경변수 미설정 — 빌드 전용 placeholder 클라이언트를 사용합니다.",
    );
    return createClient(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseKey || "placeholder-key",
      { auth: { persistSession: false } },
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

// 이 인스턴스는 서버(Server Actions, API Routes)에서만 사용해야 합니다.
export const supabase = createSupabaseClient();
