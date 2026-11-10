import { createSupabaseApi } from './api-supabase.js?v=262bf9e8';
import { createDemoApi } from './api-demo.js?v=262bf9e8';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
