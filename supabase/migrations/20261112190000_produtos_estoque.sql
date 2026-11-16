-- =====================================================================
-- Estokei: fornecedores, produtos e movimentos de estoque
--
-- Regras que moram no banco (não no navegador):
-- * o saldo de estoque só muda pela função record_stock_movement, que trava
--   a linha do produto: duas operações ao mesmo tempo não se sobrescrevem;
-- * o histórico de movimentos não se edita nem se apaga (correção = ajuste);
-- * o código do produto é gerado em sequência por empresa (P00001…).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fornecedores
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  document text check (document ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
  contact_name text check (char_length(contact_name) <= 200),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 200),
  notes text check (char_length(notes) <= 2000),
  active boolean not null default true,
  last_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite FK composta (id + empresa) nas tabelas que apontam para cá.
  unique (id, organization_id)
);
create index suppliers_org_name_idx on public.suppliers (organization_id, name);

create trigger suppliers_touch_updated_at before update on public.suppliers
  for each row execute function public.touch_updated_at();
create trigger suppliers_last_updated_by before insert or update on public.suppliers
  for each row execute function public.set_last_updated_by();

-- ---------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 40),
  name text not null check (char_length(name) between 1 and 200),
  barcode text check (barcode ~ '^[0-9]{8,14}$'),
  unit text not null default 'UN' check (char_length(unit) between 1 and 10),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  stock_quantity numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  -- Filtrável pela API (o PostgREST não compara duas colunas entre si).
  low_stock boolean generated always as (min_stock > 0 and stock_quantity <= min_stock) stored,
  supplier_id uuid,
  active boolean not null default true,
  last_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, code),
  foreign key (supplier_id, organization_id)
    references public.suppliers (id, organization_id) on delete set null (supplier_id)
);
create unique index products_org_barcode_idx on public.products (organization_id, barcode)
  where barcode is not null;
create index products_org_name_idx on public.products (organization_id, name);
create index products_org_low_stock_idx on public.products (organization_id) where low_stock and active;

create trigger products_touch_updated_at before update on public.products
  for each row execute function public.touch_updated_at();
create trigger products_last_updated_by before insert or update on public.products
  for each row execute function public.set_last_updated_by();

-- Código automático: se vier vazio, gera P00001, P00002… por empresa.
create or replace function public.products_set_code()
returns trigger language plpgsql set search_path = public as $$
declare
  v_next int;
begin
  if new.code is null or btrim(new.code) = '' then
    -- Serializa a geração por empresa: dois cadastros simultâneos não pegam o mesmo número.
    perform pg_advisory_xact_lock(hashtextextended('products_code:' || new.organization_id::text, 0));
    select coalesce(max(substring(code from '^P([0-9]+)$')::int), 0) + 1
      into v_next
      from public.products
     where organization_id = new.organization_id and code ~ '^P[0-9]+$';
    new.code := 'P' || lpad(v_next::text, 5, '0');
  else
    new.code := btrim(new.code);
  end if;
  return new;
end;
$$;
create trigger products_set_code before insert on public.products
  for each row execute function public.products_set_code();

-- ---------------------------------------------------------------------
-- Movimentos de estoque (livro-razão: só inserção, pela função abaixo)
-- ---------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  kind text not null check (kind in ('entrada', 'perda', 'ajuste', 'venda', 'estorno')),
  -- Variação do saldo (positiva ou negativa) e saldo logo depois do movimento.
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  balance_after numeric(14,3) not null,
  unit_cost numeric(12,2) check (unit_cost >= 0),
  supplier_id uuid,
  reference text check (char_length(reference) <= 100),
  notes text check (char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (product_id, organization_id)
    references public.products (id, organization_id) on delete restrict,
  foreign key (supplier_id, organization_id)
    references public.suppliers (id, organization_id) on delete set null (supplier_id)
);
create index stock_movements_org_created_idx on public.stock_movements (organization_id, created_at desc);
create index stock_movements_product_created_idx on public.stock_movements (product_id, created_at desc);

-- Registra uma movimentação e atualiza o saldo do produto, numa transação.
--   entrada: soma p_quantity (> 0)
--   perda:   subtrai p_quantity (> 0); não deixa o saldo ficar negativo
--   ajuste:  p_quantity é o saldo contado (>= 0); grava a diferença
-- Só dono/administrador da empresa do produto. Vendas usam outra função (PDV).
create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_kind text,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_supplier_id uuid default null,
  p_reference text default null,
  p_notes text default null
)
returns public.stock_movements
language plpgsql security definer set search_path = public as $$
declare
  v_product public.products;
  v_delta numeric(14,3);
  v_new_balance numeric(14,3);
  v_movement public.stock_movements;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind not in ('entrada', 'perda', 'ajuste') then
    raise exception 'Tipo de movimento inválido.';
  end if;
  if p_quantity is null or p_quantity < 0 or (p_kind <> 'ajuste' and p_quantity = 0) then
    raise exception 'Informe uma quantidade válida.';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if v_product.id is null
     or v_product.organization_id not in (select public.user_admin_organization_ids()) then
    raise exception 'Produto não encontrado.';
  end if;

  v_delta := case p_kind
    when 'entrada' then p_quantity
    when 'perda' then -p_quantity
    else p_quantity - v_product.stock_quantity
  end;
  if v_delta = 0 then
    raise exception 'O estoque já está com essa quantidade.';
  end if;

  v_new_balance := v_product.stock_quantity + v_delta;
  if v_new_balance < 0 then
    raise exception 'Estoque insuficiente: o saldo atual é %.', v_product.stock_quantity;
  end if;

  update public.products set stock_quantity = v_new_balance where id = v_product.id;

  -- Custo informado na entrada vira o novo preço de custo do produto.
  if p_kind = 'entrada' and p_unit_cost is not null then
    update public.products set cost_price = p_unit_cost where id = v_product.id;
  end if;

  insert into public.stock_movements (
    organization_id, product_id, kind, quantity_delta, balance_after,
    unit_cost, supplier_id, reference, notes, created_by
  ) values (
    v_product.organization_id, v_product.id, p_kind, v_delta, v_new_balance,
    case when p_kind = 'entrada' then p_unit_cost end,
    case when p_kind = 'entrada' then p_supplier_id end,
    nullif(btrim(p_reference), ''), nullif(btrim(p_notes), ''), auth.uid()
  ) returning * into v_movement;

  return v_movement;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS: toda a equipe consulta; dono/administrador cadastra e altera.
-- ---------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create policy org_isolation_select on public.suppliers for select
  using (organization_id in (select public.user_organization_ids()));
create policy org_admins_insert on public.suppliers for insert
  with check (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_update on public.suppliers for update
  using (organization_id in (select public.user_admin_organization_ids()))
  with check (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_delete on public.suppliers for delete
  using (organization_id in (select public.user_admin_organization_ids()));

create policy org_isolation_select on public.products for select
  using (organization_id in (select public.user_organization_ids()));
create policy org_admins_insert on public.products for insert
  with check (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_update on public.products for update
  using (organization_id in (select public.user_admin_organization_ids()))
  with check (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_delete on public.products for delete
  using (organization_id in (select public.user_admin_organization_ids()));

-- Movimentos: só leitura pela API; a escrita é da função record_stock_movement.
create policy org_isolation_select on public.stock_movements for select
  using (organization_id in (select public.user_organization_ids()));

-- ---------------------------------------------------------------------
-- Permissões por coluna: o saldo nunca é gravado direto pelo app.
-- ---------------------------------------------------------------------
revoke all on public.suppliers, public.products, public.stock_movements from anon;
revoke insert, update, delete on public.stock_movements from authenticated;
grant select on public.stock_movements to authenticated;

revoke insert, update on public.products from authenticated;
grant insert (organization_id, code, name, barcode, unit, cost_price, sale_price,
              min_stock, supplier_id, active)
  on public.products to authenticated;
grant update (code, name, barcode, unit, cost_price, sale_price, min_stock, supplier_id, active)
  on public.products to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, delete on public.products to authenticated;

revoke all on function public.record_stock_movement(uuid, text, numeric, numeric, uuid, text, text)
  from public, anon;
grant execute on function public.record_stock_movement(uuid, text, numeric, numeric, uuid, text, text)
  to authenticated;
revoke all on function public.products_set_code() from public, anon, authenticated;
