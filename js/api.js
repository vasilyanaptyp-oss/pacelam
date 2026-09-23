import { createSupabaseApi } from './api-supabase.js?v=7f588610';
import { createDemoApi } from './api-demo.js?v=7f588610';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
