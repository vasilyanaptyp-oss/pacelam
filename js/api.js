import { createSupabaseApi } from './api-supabase.js?v=8a726e6e';
import { createDemoApi } from './api-demo.js?v=8a726e6e';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
