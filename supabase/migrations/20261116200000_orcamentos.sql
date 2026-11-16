-- =====================================================================
-- Estokei: orçamentos e dados da loja
--
-- * Dados da loja (CNPJ, telefone, e-mail, endereço) para o PDF do orçamento
--   e o cupom. Usuário não tem UPDATE em organizations: a gravação é pela
--   função update_store_profile, só dono/administrador.
-- * Orçamento: preços vêm do cadastro do produto no momento em que é salvo
--   (save_quote) e ficam valendo até a validade. Converter em venda
--   (convert_quote) usa esses preços e baixa o estoque pela mesma rotina do
--   PDV (_record_sale), com as mesmas travas.
-- * finalize_sale passa a delegar para _record_sale (comportamento igual).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Dados da loja
-- ---------------------------------------------------------------------
alter table public.organizations
  add column store_document text check (store_document ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
  add column store_phone text check (char_length(store_phone) <= 30),
  add column store_email text check (char_length(store_email) <= 200),
  add column store_address text check (char_length(store_address) <= 300);

create or replace function public.update_store_profile(
  p_organization_id uuid,
  p_document text,
  p_phone text,
  p_email text,
  p_address text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_organization_id is null
     or p_organization_id not in (select public.user_admin_organization_ids()) then
    raise exception 'Só o dono e os administradores alteram os dados da loja.';
  end if;
  update public.organizations
     set store_document = nullif(btrim(p_document), ''),
         store_phone = nullif(btrim(p_phone), ''),
         store_email = nullif(btrim(p_email), ''),
         store_address = nullif(btrim(p_address), '')
   where id = p_organization_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Rotina interna de venda (não exposta na API)
--   p_lines: [{"product_id": "...", "quantity": 2, "unit_price": 10.5 | null}]
--   unit_price null = preço atual do cadastro (PDV); com valor = preço do
--   orçamento. Quem chama já validou empresa, pagamento, cliente e itens.
-- ---------------------------------------------------------------------
create or replace function public._record_sale(
  p_organization_id uuid,
  p_lines jsonb,
  p_payment_method text,
  p_customer_id uuid,
  p_discount numeric,
  p_amount_received numeric,
  p_notes text
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
  v_price numeric(12,2);
  v_new_balance numeric(14,3);
  v_line_total numeric(12,2);
begin
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
    select (e->>'product_id')::uuid as product_id,
           sum((e->>'quantity')::numeric) as quantity,
           max((e->>'unit_price')::numeric) as unit_price
      from jsonb_array_elements(p_lines) e
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

    v_price := coalesce(v_line.unit_price, v_product.sale_price);
    v_line_total := round(v_line.quantity * v_price, 2);
    v_subtotal := v_subtotal + v_line_total;

    update public.products set stock_quantity = v_new_balance where id = v_product.id;

    insert into public.sale_items (
      organization_id, sale_id, product_id, product_code, product_name, unit,
      quantity, unit_price, total
    ) values (
      p_organization_id, v_sale.id, v_product.id, v_product.code, v_product.name, v_product.unit,
      v_line.quantity, v_price, v_line_total
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

-- PDV: mesmas validações de antes; o preço é sempre o do cadastro (qualquer
-- "unit_price" mandado pelo navegador é descartado).
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

  return public._record_sale(
    p_organization_id,
    (select jsonb_agg(jsonb_build_object('product_id', e->'product_id', 'quantity', e->'quantity'))
       from jsonb_array_elements(p_items) e),
    p_payment_method, p_customer_id, p_discount, p_amount_received, p_notes
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Orçamentos
-- ---------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number int not null check (number > 0),
  status text not null default 'aberto' check (status in ('aberto', 'convertido', 'cancelado')),
  customer_id uuid,
  -- Para quem ainda não é cliente cadastrado (aparece no PDF).
  customer_name text check (char_length(customer_name) <= 200),
  valid_until date not null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  notes text check (char_length(notes) <= 1000),
  sale_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  last_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, number),
  check (discount <= subtotal and total = subtotal - discount),
  check ((status = 'convertido') = (sale_id is not null)),
  foreign key (customer_id, organization_id)
    references public.customers (id, organization_id) on delete restrict,
  foreign key (sale_id, organization_id)
    references public.sales (id, organization_id) on delete restrict
);
create index quotes_org_created_idx on public.quotes (organization_id, created_at desc);
create index quotes_customer_idx on public.quotes (customer_id) where customer_id is not null;

create trigger quotes_touch_updated_at before update on public.quotes
  for each row execute function public.touch_updated_at();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null,
  product_id uuid not null,
  position int not null default 0,
  product_code text not null,
  product_name text not null,
  unit text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total numeric(12,2) not null check (total >= 0),
  foreign key (quote_id, organization_id)
    references public.quotes (id, organization_id) on delete cascade,
  foreign key (product_id, organization_id)
    references public.products (id, organization_id) on delete restrict
);
create index quote_items_quote_idx on public.quote_items (quote_id, position);
create index quote_items_product_idx on public.quote_items (product_id);

-- Cria ou edita um orçamento aberto. Preços do cadastro no momento de salvar.
--   p_items: [{"product_id": "...", "quantity": 2}, ...] (na ordem da tela)
-- Qualquer pessoa da equipe (o vendedor faz orçamento).
create or replace function public.save_quote(
  p_organization_id uuid,
  p_quote_id uuid,
  p_items jsonb,
  p_valid_until date,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_discount numeric default 0,
  p_notes text default null
)
returns public.quotes
language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotes;
  v_number int;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := coalesce(p_discount, 0);
  v_line record;
  v_product public.products;
  v_line_total numeric(12,2);
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_organization_id is null
     or p_organization_id not in (select public.user_organization_ids()) then
    raise exception 'Empresa não encontrada.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um produto.';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Orçamento com itens demais (máximo 200).';
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
  if p_valid_until is null or p_valid_until < v_today or p_valid_until > v_today + 365 then
    raise exception 'Validade inválida: escolha uma data entre hoje e um ano.';
  end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers
     where id = p_customer_id and organization_id = p_organization_id
  ) then
    raise exception 'Cliente não encontrado.';
  end if;

  if p_quote_id is null then
    perform pg_advisory_xact_lock(hashtextextended('quotes_number:' || p_organization_id::text, 0));
    select coalesce(max(number), 0) + 1 into v_number
      from public.quotes where organization_id = p_organization_id;
    insert into public.quotes (organization_id, number, valid_until, created_by)
    values (p_organization_id, v_number, p_valid_until, auth.uid())
    returning * into v_quote;
  else
    select * into v_quote from public.quotes
     where id = p_quote_id and organization_id = p_organization_id
       for update;
    if v_quote.id is null then
      raise exception 'Orçamento não encontrado.';
    end if;
    if v_quote.status <> 'aberto' then
      raise exception 'Este orçamento já foi % e não pode ser alterado.',
        case v_quote.status when 'convertido' then 'convertido em venda' else 'cancelado' end;
    end if;
    delete from public.quote_items where quote_id = v_quote.id;
  end if;

  for v_line in
    select (e->>'product_id')::uuid as product_id,
           sum((e->>'quantity')::numeric) as quantity,
           min(ord) as position
      from jsonb_array_elements(p_items) with ordinality as t(e, ord)
     group by 1
     order by 3
  loop
    select * into v_product from public.products
     where id = v_line.product_id and organization_id = p_organization_id;
    if v_product.id is null then
      raise exception 'Produto não encontrado.';
    end if;
    if not v_product.active then
      raise exception 'O produto % está inativo.', v_product.name;
    end if;
    v_line_total := round(v_line.quantity * v_product.sale_price, 2);
    v_subtotal := v_subtotal + v_line_total;
    insert into public.quote_items (
      organization_id, quote_id, product_id, position, product_code, product_name, unit,
      quantity, unit_price, total
    ) values (
      p_organization_id, v_quote.id, v_product.id, v_line.position, v_product.code, v_product.name,
      v_product.unit, v_line.quantity, v_product.sale_price, v_line_total
    );
  end loop;

  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'Desconto inválido: precisa ficar entre zero e o subtotal.';
  end if;

  update public.quotes
     set customer_id = p_customer_id,
         customer_name = case when p_customer_id is null then nullif(left(btrim(p_customer_name), 200), '') end,
         valid_until = p_valid_until,
         subtotal = v_subtotal,
         discount = v_discount,
         total = v_subtotal - v_discount,
         notes = nullif(left(btrim(p_notes), 1000), ''),
         last_updated_by = auth.uid()
   where id = v_quote.id
   returning * into v_quote;

  return v_quote;
end;
$$;

-- Cancela um orçamento aberto. Qualquer pessoa da equipe.
create or replace function public.cancel_quote(p_quote_id uuid)
returns public.quotes
language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotes;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if v_quote.id is null
     or v_quote.organization_id not in (select public.user_organization_ids()) then
    raise exception 'Orçamento não encontrado.';
  end if;
  if v_quote.status <> 'aberto' then
    raise exception 'Só orçamentos em aberto podem ser cancelados.';
  end if;
  update public.quotes set status = 'cancelado', last_updated_by = auth.uid()
   where id = v_quote.id returning * into v_quote;
  return v_quote;
end;
$$;

-- Converte um orçamento aberto e dentro da validade em venda, com os preços
-- e o desconto do orçamento. Baixa o estoque como o PDV.
create or replace function public.convert_quote(
  p_quote_id uuid,
  p_payment_method text,
  p_amount_received numeric default null
)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotes;
  v_sale public.sales;
  v_lines jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if v_quote.id is null
     or v_quote.organization_id not in (select public.user_organization_ids()) then
    raise exception 'Orçamento não encontrado.';
  end if;
  if v_quote.status <> 'aberto' then
    raise exception 'Este orçamento já foi %.',
      case v_quote.status when 'convertido' then 'convertido em venda' else 'cancelado' end;
  end if;
  if v_quote.valid_until < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Orçamento vencido: edite e salve de novo para atualizar preços e validade.';
  end if;
  if p_payment_method is null
     or p_payment_method not in ('dinheiro', 'pix', 'debito', 'credito', 'fiado', 'outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_payment_method = 'fiado' and v_quote.customer_id is null then
    raise exception 'Venda fiado precisa de um cliente cadastrado no orçamento.';
  end if;

  select jsonb_agg(jsonb_build_object(
           'product_id', qi.product_id, 'quantity', qi.quantity, 'unit_price', qi.unit_price))
    into v_lines
    from public.quote_items qi
   where qi.quote_id = v_quote.id;

  v_sale := public._record_sale(
    v_quote.organization_id, v_lines, p_payment_method, v_quote.customer_id,
    v_quote.discount, p_amount_received, 'Orçamento #' || v_quote.number
  );

  update public.quotes
     set status = 'convertido', sale_id = v_sale.id, last_updated_by = auth.uid()
   where id = v_quote.id;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS: toda a equipe consulta; a escrita é só pelas funções acima.
-- ---------------------------------------------------------------------
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

create policy org_isolation_select on public.quotes for select
  using (organization_id in (select public.user_organization_ids()));
create policy org_isolation_select on public.quote_items for select
  using (organization_id in (select public.user_organization_ids()));

revoke all on public.quotes, public.quote_items from anon;
revoke insert, update, delete on public.quotes, public.quote_items from authenticated;
grant select on public.quotes, public.quote_items to authenticated;

-- Rotina interna: ninguém chama pela API.
revoke all on function public._record_sale(uuid, jsonb, text, uuid, numeric, numeric, text)
  from public, anon, authenticated;

revoke all on function public.update_store_profile(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_store_profile(uuid, text, text, text, text) to authenticated;
revoke all on function public.save_quote(uuid, uuid, jsonb, date, uuid, text, numeric, text) from public, anon;
grant execute on function public.save_quote(uuid, uuid, jsonb, date, uuid, text, numeric, text) to authenticated;
revoke all on function public.cancel_quote(uuid) from public, anon;
grant execute on function public.cancel_quote(uuid) to authenticated;
revoke all on function public.convert_quote(uuid, text, numeric) from public, anon;
grant execute on function public.convert_quote(uuid, text, numeric) to authenticated;
