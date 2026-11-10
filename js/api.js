import { createSupabaseApi } from './api-supabase.js?v=6d72789e';
import { createDemoApi } from './api-demo.js?v=6d72789e';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
