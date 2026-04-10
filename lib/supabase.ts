import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// 서비스 롤 키가 없다면 아쉬운대로 익명 키 사용 (환경변수에 있는 경우)
const supabaseServiceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 이 인스턴스는 서버(Server Actions, API Routes)에서만 사용해야 합니다.
export const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: { persistSession: false },
});
