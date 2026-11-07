// Lazy so the Supabase SDK stays out of the entry chunk (public routes never need it).
export const getSupabase = () => import("@/integrations/supabase/client").then((m) => m.supabase);
