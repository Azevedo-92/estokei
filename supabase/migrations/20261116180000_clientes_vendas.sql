-- =====================================================================
-- Estokei: clientes e vendas (PDV)
--
-- Regras que moram no banco (não no navegador):
-- * a venda é registrada inteira pela função finalize_sale, numa transação:
--   preços vêm do cadastro do produto, o estoque é baixado com a linha do
--   produto travada e cada item gera um movimento 'venda' no histórico;
-- * cancelar (cancel_sale) devolve o estoque com movimentos 'estorno';
-- * vendas e itens não se editam nem se apagam pela API.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  document text check (document ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 200),
  address text check (char_length(address) <= 500),
  notes text check (char_length(notes) <= 2000),
  active boolean not null default true,
  last_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index customers_org_name_idx on public.customers (organization_id, name);
create unique index customers_org_document_idx on public.customers (organization_id, document)
  where document is not null;

create trigger customers_touch_updated_at before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger customers_last_updated_by before insert or update on public.customers
  for each row execute function public.set_last_updated_by();

-- ---------------------------------------------------------------------
-- Vendas e itens
-- ---------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number int not null check (number > 0),
  status text not null default 'concluida' check (status in ('concluida', 'cancelada')),
  customer_id uuid,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null
    check (payment_method in ('dinheiro', 'pix', 'debito', 'credito', 'fiado', 'outro')),
  amount_received numeric(12,2) check (amount_received >= 0),
  change_amount numeric(12,2) check (change_amount >= 0),
  notes text check (char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  canceled_by uuid references auth.users(id) on delete set null,
  cancel_reason text check (char_length(cancel_reason) <= 500),
  unique (id, organization_id),
  unique (organization_id, number),
  check (discount <= subtotal and total = subtotal - discount),
  check (payment_method <> 'fiado' or customer_id is not null),
  check ((status = 'cancelada') = (canceled_at is not null)),
  foreign key (customer_id, organization_id)
    references public.customers (id, organization_id) on delete restrict
);
create index sales_org_created_idx on public.sales (organization_id, created_at desc);
create index sales_customer_idx on public.sales (customer_id, created_at desc) where customer_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  -- Cópia do cadastro no momento da venda (o produto pode mudar depois).
  product_code text not null,
  product_name text not null,
  unit text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total numeric(12,2) not null check (total >= 0),
  foreign key (sale_id, organization_id)
    references public.sales (id, organization_id) on delete cascade,
  foreign key (product_id, organization_id)
    references public.products (id, organization_id) on delete restrict
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- Liga o movimento de estoque à venda que o gerou.
alter table public.stock_movements add column sale_id uuid;
alter table public.stock_movements
  add constraint stock_movements_sale_fk foreign key (sale_id, organization_id)
  references public.sales (id, organization_id) on delete restrict;
create index stock_movements_sale_idx on public.stock_movements (sale_id) where sale_id is not null;

-- ---------------------------------------------------------------------
-- finalize_sale: registra a venda e baixa o estoque, tudo ou nada.
--   p_items: [{"product_id": "...", "quantity": 2}, ...]
-- Qualquer pessoa da equipe pode vender (caixa, vendedor, dono).
-- ---------------------------------------------------------------------
create or replace function public.finalize_sale(
  p_organization_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_customer_id uuid default null,
  p_discount numeric default 0,
  p_amount_received numeric default null,
  p_notes text default null
)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_number int;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := coalesce(p_discount, 0);
  v_total numeric(12,2);
  v_change numeric(12,2);
  v_line record;
  v_product public.products;
  v_new_balance numeric(14,3);
  v_line_total numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_organization_id is null
     or p_organization_id not in (select public.user_organization_ids()) then
    raise exception 'Empresa não encontrada.';
  end if;
  if p_payment_method is null
     or p_payment_method not in ('dinheiro', 'pix', 'debito', 'credito', 'fiado', 'outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um produto.';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Venda com itens demais (máximo 200).';
  end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers
     where id = p_customer_id and organization_id = p_organization_id
  ) then
    raise exception 'Cliente não encontrado.';
  end if;
  if p_payment_method = 'fiado' and p_customer_id is null then
    raise exception 'Venda fiado precisa de um cliente.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e->>'product_id', '') !~ '^[0-9a-fA-F-]{36}$'
        or coalesce(e->>'quantity', '') !~ '^[0-9]+(\.[0-9]+)?$'
        or (e->>'quantity')::numeric <= 0
  ) then
    raise exception 'Informe uma quantidade válida.';
  end if;

  -- Número sequencial por empresa.
  perform pg_advisory_xact_lock(hashtextextended('sales_number:' || p_organization_id::text, 0));
  select coalesce(max(number), 0) + 1 into v_number
    from public.sales where organization_id = p_organization_id;

  insert into public.sales (
    organization_id, number, customer_id, subtotal, discount, total,
    payment_method, notes, created_by
  ) values (
    p_organization_id, v_number, p_customer_id, 0, 0, 0,
    p_payment_method, nullif(btrim(p_notes), ''), auth.uid()
  ) returning * into v_sale;

  -- Itens agrupados por produto, em ordem de id: a trava das linhas segue
  -- sempre a mesma ordem e duas vendas simultâneas não se bloqueiam em ciclo.
  for v_line in
    select (e->>'product_id')::uuid as product_id, sum((e->>'quantity')::numeric) as quantity
      from jsonb_array_elements(p_items) e
     group by 1
     order by 1
  loop
    select * into v_product from public.products
     where id = v_line.product_id and organization_id = p_organization_id
       for update;
    if v_product.id is null then
      raise exception 'Produto não encontrado.';
    end if;
    if not v_product.active then
      raise exception 'O produto % está inativo.', v_product.name;
    end if;
    v_new_balance := v_product.stock_quantity - v_line.quantity;
    if v_new_balance < 0 then
      raise exception 'Estoque insuficiente de %: o saldo atual é %.',
        v_product.name, v_product.stock_quantity;
    end if;

    v_line_total := round(v_line.quantity * v_product.sale_price, 2);
    v_subtotal := v_subtotal + v_line_total;

    update public.products set stock_quantity = v_new_balance where id = v_product.id;

    insert into public.sale_items (
      organization_id, sale_id, product_id, product_code, product_name, unit,
      quantity, unit_price, total
    ) values (
      p_organization_id, v_sale.id, v_product.id, v_product.code, v_product.name, v_product.unit,
      v_line.quantity, v_product.sale_price, v_line_total
    );

    insert into public.stock_movements (
      organization_id, product_id, kind, quantity_delta, balance_after,
      reference, created_by, sale_id
    ) values (
      p_organization_id, v_product.id, 'venda', -v_line.quantity, v_new_balance,
      'Venda #' || v_number, auth.uid(), v_sale.id
    );
  end loop;

  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'Desconto inválido: precisa ficar entre zero e o subtotal.';
  end if;
  v_total := v_subtotal - v_discount;

  if p_payment_method = 'dinheiro' and p_amount_received is not null then
    if p_amount_received < v_total then
      raise exception 'Valor recebido é menor que o total da venda.';
    end if;
    v_change := p_amount_received - v_total;
  end if;

  update public.sales
     set subtotal = v_subtotal,
         discount = v_discount,
         total = v_total,
         amount_received = case when p_payment_method = 'dinheiro' then p_amount_received end,
         change_amount = v_change
   where id = v_sale.id
   returning * into v_sale;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- cancel_sale: cancela a venda e devolve o estoque. Só dono/administrador.
-- ---------------------------------------------------------------------
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_item record;
  v_new_balance numeric(14,3);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null
     or v_sale.organization_id not in (select public.user_admin_organization_ids()) then
    raise exception 'Venda não encontrada.';
  end if;
  if v_sale.status = 'cancelada' then
    raise exception 'Esta venda já foi cancelada.';
  end if;

  for v_item in
    select si.product_id, sum(si.quantity) as quantity
      from public.sale_items si
     where si.sale_id = v_sale.id
     group by si.product_id
     order by si.product_id
  loop
    update public.products
       set stock_quantity = stock_quantity + v_item.quantity
     where id = v_item.product_id
     returning stock_quantity into v_new_balance;

    insert into public.stock_movements (
      organization_id, product_id, kind, quantity_delta, balance_after,
      reference, notes, created_by, sale_id
    ) values (
      v_sale.organization_id, v_item.product_id, 'estorno', v_item.quantity, v_new_balance,
      'Venda #' || v_sale.number, 'Cancelamento: ' || left(btrim(p_reason), 480),
      auth.uid(), v_sale.id
    );
  end loop;

  update public.sales
     set status = 'cancelada',
         canceled_at = now(),
         canceled_by = auth.uid(),
         cancel_reason = left(btrim(p_reason), 500)
   where id = v_sale.id
   returning * into v_sale;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- Clientes: toda a equipe consulta, cadastra e edita (o caixa cadastra no
-- balcão); apagar é só dono/administrador.
-- Vendas e itens: toda a equipe consulta; a escrita é só pelas funções.
-- ---------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy org_isolation_select on public.customers for select
  using (organization_id in (select public.user_organization_ids()));
create policy org_isolation_insert on public.customers for insert
  with check (organization_id in (select public.user_organization_ids()));
create policy org_isolation_update on public.customers for update
  using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));
create policy org_admins_delete on public.customers for delete
  using (organization_id in (select public.user_admin_organization_ids()));

create policy org_isolation_select on public.sales for select
  using (organization_id in (select public.user_organization_ids()));
create policy org_isolation_select on public.sale_items for select
  using (organization_id in (select public.user_organization_ids()));

revoke all on public.customers, public.sales, public.sale_items from anon;
grant select, insert, update, delete on public.customers to authenticated;
revoke insert, update, delete on public.sales, public.sale_items from authenticated;
grant select on public.sales, public.sale_items to authenticated;

revoke all on function public.finalize_sale(uuid, jsonb, text, uuid, numeric, numeric, text)
  from public, anon;
grant execute on function public.finalize_sale(uuid, jsonb, text, uuid, numeric, numeric, text)
  to authenticated;
revoke all on function public.cancel_sale(uuid, text) from public, anon;
grant execute on function public.cancel_sale(uuid, text) to authenticated;
