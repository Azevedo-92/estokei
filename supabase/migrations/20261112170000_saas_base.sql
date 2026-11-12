-- =====================================================================
-- Estokei: base SaaS (empresas, equipe, convites, cobrança, suporte)
--
-- Extraída do schema do ClientCycle (mesma estrutura, já validada em
-- produção), sem as tabelas do CRM e sem colunas legadas.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_last_updated_by()
returns trigger language plpgsql as $$
begin
  new.last_updated_by := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Empresas (tenants)
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text,
  status text not null default 'pending'
    check (status in ('active', 'pending', 'suspended')),
  status_changed_at timestamptz,
  status_reason text check (char_length(status_reason) <= 200),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.organizations is
  'Empresas contratantes do Estokei (tenants). Cada uma isola seus próprios dados e usuários.';

create trigger set_updated_at before update on public.organizations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Perfis (um por usuário do Supabase Auth)
-- ---------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Membros da empresa
-- ---------------------------------------------------------------------
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  constraint organization_members_user_profile_fkey
    foreign key (user_id) references public.profiles(user_id) on delete cascade
);
create index organization_members_organization_id_idx on public.organization_members (organization_id);
create index organization_members_user_id_idx on public.organization_members (user_id);

-- Base do RLS: empresas do usuário logado (e as que ele administra)
create or replace function public.user_organization_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_members where user_id = auth.uid();
$$;
comment on function public.user_organization_ids() is
  'Orgs onde o usuário logado é membro. Usada nas policies de RLS.';

create or replace function public.user_admin_organization_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_members
  where user_id = auth.uid() and role in ('owner', 'admin');
$$;
comment on function public.user_admin_organization_ids() is
  'Orgs onde o usuário logado é dono ou administrador. Usada nas policies de organization_members.';

-- Impede remover ou rebaixar o último dono
create or replace function public.protect_last_owner()
returns trigger language plpgsql as $$
declare
  v_owner_count int;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      select count(*) into v_owner_count from public.organization_members
        where organization_id = old.organization_id and role = 'owner';
      if v_owner_count <= 1 then
        raise exception 'Não é possível remover o último owner da organização';
      end if;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' then
      select count(*) into v_owner_count from public.organization_members
        where organization_id = old.organization_id and role = 'owner';
      if v_owner_count <= 1 then
        raise exception 'Não é possível rebaixar o último owner da organização';
      end if;
    end if;
    return new;
  end if;
  return null;
end;
$$;
create trigger tg_protect_last_owner before delete or update on public.organization_members
  for each row execute function public.protect_last_owner();

-- Cadastro: cria a empresa (pendente) e coloca quem cadastrou como dono
create or replace function public.create_organization_and_join(org_name text, org_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.organizations (name, slug)
  values (org_name, org_slug)
  returning id into new_org_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');
  return new_org_id;
end;
$$;

-- Novo usuário do Auth → perfil
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  invited_by uuid references auth.users(id),
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint invites_invited_by_profile_fkey
    foreign key (invited_by) references public.profiles(user_id) on delete set null
);
create index invites_organization_id_accepted_at_idx on public.invites (organization_id, accepted_at);
create index invites_token_idx on public.invites (token) where accepted_at is null;

create or replace function public.get_invite_summary(invite_token text)
returns table (organization_id uuid, organization_name text, role text, email text,
               expires_at timestamptz, already_accepted boolean, invited_by_name text)
language sql stable security definer set search_path = public as $$
  select i.organization_id, o.name, i.role, i.email, i.expires_at,
         (i.accepted_at is not null), p.full_name
  from public.invites i
  join public.organizations o on o.id = i.organization_id
  left join public.profiles p on p.user_id = i.invited_by
  where i.token = invite_token
  limit 1;
$$;

create or replace function public.accept_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invite record;
  v_user_id uuid := auth.uid();
  v_user_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite from public.invites
    where token = invite_token and accepted_at is null and expires_at > now()
    for update;
  if v_invite.id is null then
    raise exception 'Convite não encontrado ou expirado';
  end if;

  if v_invite.email is not null then
    select email into v_user_email from auth.users where id = v_user_id;
    if lower(trim(coalesce(v_user_email, ''))) <> lower(trim(v_invite.email)) then
      raise exception 'Este convite foi enviado para outro e-mail. Entre com a conta convidada.';
    end if;
  end if;

  if exists (select 1 from public.organization_members
             where organization_id = v_invite.organization_id and user_id = v_user_id) then
    update public.invites set accepted_at = now(), accepted_by = v_user_id where id = v_invite.id;
    return v_invite.organization_id;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_user_id, v_invite.role);
  update public.invites set accepted_at = now(), accepted_by = v_user_id where id = v_invite.id;
  return v_invite.organization_id;
end;
$$;

create or replace function public.my_pending_invites()
returns table (token text, organization_name text, role text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.token, o.name, i.role, i.expires_at
  from public.invites i
  join public.organizations o on o.id = i.organization_id
  where i.accepted_at is null
    and i.expires_at > now()
    and i.email is not null
    and lower(trim(i.email)) = (select lower(trim(u.email)) from auth.users u where u.id = auth.uid())
  order by i.created_at desc;
$$;

-- ---------------------------------------------------------------------
-- Cobrança (Asaas): só o service role grava
-- ---------------------------------------------------------------------
create table public.subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null check (plan in ('essencial', 'profissional', 'completo')),
  cycle text not null check (cycle in ('monthly', 'yearly')),
  value numeric(10,2) not null check (value > 0),
  billing_name text not null check (char_length(billing_name) between 2 and 200),
  billing_document text not null check (billing_document ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
  billing_email text not null check (char_length(billing_email) <= 200),
  asaas_customer_id text not null,
  asaas_subscription_id text not null unique,
  canceled_at timestamptz,
  nfse_configured_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_touch_updated_at before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table public.subscription_payments (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asaas_subscription_id text not null,
  value numeric(10,2) not null,
  status text not null,
  billing_type text,
  due_date date not null,
  paid_at date,
  invoice_url text,
  deleted boolean not null default false,
  invoice_id text,
  invoice_status text,
  invoice_number text,
  invoice_pdf_url text,
  invoice_error text check (char_length(invoice_error) <= 1000),
  updated_at timestamptz not null default now()
);
create index subscription_payments_org_due_idx on public.subscription_payments (organization_id, due_date desc);
create index subscription_payments_overdue_idx on public.subscription_payments (due_date)
  where status = 'OVERDUE' and not deleted;
create unique index subscription_payments_invoice_id_idx on public.subscription_payments (invoice_id)
  where invoice_id is not null;

-- ---------------------------------------------------------------------
-- Pedidos de suporte
-- ---------------------------------------------------------------------
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('duvida', 'problema', 'sugestao')),
  message text not null check (char_length(message) between 10 and 5000),
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);
create index support_requests_organization_id_created_at_idx on public.support_requests (organization_id, created_at desc);
create index support_requests_created_by_created_at_idx on public.support_requests (created_by, created_at desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.invites enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.support_requests enable row level security;

-- Empresa: membros leem; ninguém altera pelo app (só service role)
create policy org_members_can_read_org on public.organizations for select
  using (id in (select public.user_organization_ids()));

-- Perfis: o próprio e os colegas de empresa
create policy user_can_read_own_profile_and_org_peers on public.profiles for select
  using (user_id = auth.uid() or user_id in (
    select om.user_id from public.organization_members om
    where om.organization_id in (select public.user_organization_ids())));
create policy user_can_insert_own_profile on public.profiles for insert
  with check (user_id = auth.uid());
create policy user_can_update_own_profile on public.profiles for update
  using (user_id = auth.uid());

-- Membros
create policy org_members_can_read_members on public.organization_members for select
  using (organization_id in (select public.user_organization_ids()));
create policy org_admins_can_insert_members on public.organization_members for insert
  with check (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_can_update_members on public.organization_members for update
  using (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_or_self_can_delete_member on public.organization_members for delete
  using (user_id = auth.uid() or organization_id in (select public.user_admin_organization_ids()));

-- Convites
create policy members_can_read_invites on public.invites for select
  using (organization_id in (select public.user_organization_ids()));
create policy admins_can_insert_invites on public.invites for insert
  with check (organization_id in (select public.user_admin_organization_ids()));
create policy admins_can_delete_invites on public.invites for delete
  using (organization_id in (select public.user_admin_organization_ids()));

-- Cobrança: dono/admin só lê
create policy org_admins_select_subscriptions on public.subscriptions for select
  using (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_select_subscription_payments on public.subscription_payments for select
  using (organization_id in (select public.user_admin_organization_ids()));

-- Suporte
create policy org_select_support_requests on public.support_requests for select
  using (organization_id in (select public.user_organization_ids()));
create policy org_insert_support_requests on public.support_requests for insert
  with check (organization_id in (select public.user_organization_ids()) and created_by = auth.uid());
create policy org_update_support_requests on public.support_requests for update
  using (organization_id in (select public.user_organization_ids()));
create policy org_delete_support_requests on public.support_requests for delete
  using (organization_id in (select public.user_organization_ids()));

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.support_requests to authenticated;
grant select on public.subscriptions, public.subscription_payments to authenticated;
grant select, insert, update, delete on public.subscriptions, public.subscription_payments to service_role;

-- Funções SECURITY DEFINER: ninguém de fora chama, exceto o que a tela pública
-- de convite precisa. As usadas pelo RLS continuam acessíveis a quem está logado.
revoke all on function
  public.user_organization_ids(), public.user_admin_organization_ids(),
  public.create_organization_and_join(text, text), public.handle_new_user(),
  public.get_invite_summary(text), public.accept_invite(text), public.my_pending_invites()
from public, anon;
grant execute on function public.user_organization_ids(), public.user_admin_organization_ids()
  to authenticated;
grant execute on function public.create_organization_and_join(text, text) to authenticated;
grant execute on function public.get_invite_summary(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.my_pending_invites() to authenticated;

-- ---------------------------------------------------------------------
-- Logos das empresas (Storage): leitura pública, escrita só dono/admin
-- Caminho: {organization_id}/logo.{ext}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-logos', 'org-logos', true, 1048576,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy org_admins_upload_logo on storage.objects for insert
  with check (bucket_id = 'org-logos' and (storage.foldername(name))[1] in (
    select organization_id::text from public.organization_members
    where user_id = auth.uid() and role in ('owner', 'admin')));
create policy org_admins_update_logo on storage.objects for update
  using (bucket_id = 'org-logos' and (storage.foldername(name))[1] in (
    select organization_id::text from public.organization_members
    where user_id = auth.uid() and role in ('owner', 'admin')));
create policy org_admins_delete_logo on storage.objects for delete
  using (bucket_id = 'org-logos' and (storage.foldername(name))[1] in (
    select organization_id::text from public.organization_members
    where user_id = auth.uid() and role in ('owner', 'admin')));
