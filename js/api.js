import { createSupabaseApi } from './api-supabase.js?v=a668cfa2';
import { createDemoApi } from './api-demo.js?v=a668cfa2';

const cfg = window.PACELAM_CONFIG || {};
export const api = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? createSupabaseApi(cfg) : createDemoApi();
