import { createSupabaseApi } from './api-supabase.js?v=acda6798';
import { createDemoApi } from './api-demo.js?v=acda6798';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
