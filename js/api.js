import { createSupabaseApi } from './api-supabase.js';
import { createDemoApi } from './api-demo.js';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
