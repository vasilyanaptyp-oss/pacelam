import { createSupabaseApi } from './api-supabase.js?v=806ca22a';
import { createDemoApi } from './api-demo.js?v=806ca22a';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
