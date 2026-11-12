import { createSupabaseApi } from './api-supabase.js?v=16d5107b';
import { createDemoApi } from './api-demo.js?v=16d5107b';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
