-- Ajustes apontados pelo Security Advisor do Supabase na base SaaS.

-- Funções de trigger com search_path fixo (evita sequestro por objetos com o
-- mesmo nome em outro schema).
alter function public.touch_updated_at() set search_path = public;
alter function public.set_last_updated_by() set search_path = public;
alter function public.protect_last_owner() set search_path = public;

-- handle_new_user só roda como trigger do Auth; ninguém precisa chamá-la pela API.
revoke all on function public.handle_new_user() from authenticated;
