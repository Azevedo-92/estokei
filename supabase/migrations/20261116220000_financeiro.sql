-- =====================================================================
-- Estokei: financeiro (contas a receber e a pagar)
--
-- * financial_entries: uma linha por conta (ou parcela). Só dono e
--   administradores veem e mexem (caixa e vendedor não acessam o financeiro).
-- * Venda fiado gera sozinha uma conta a receber do cliente (vencimento em
--   30 dias), dentro de _record_sale. Cancelar a venda cancela a conta; se ela
--   já foi recebida, o cancelamento pede para estornar o recebimento antes.
-- * Contas ligadas a venda não se apagam (só se cancelam junto com a venda).
-- =====================================================================

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('receber', 'pagar')),
  description text not null check (char_length(description) between 1 and 200),
  category text check (char_length(category) <= 60),
  customer_id uuid,
  supplier_id uuid,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'cancelado')),
  paid_at date,
  paid_amount numeric(12,2) check (paid_amount >= 0),
  payment_method text
    check (payment_method in ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'outro')),
  sale_id uuid,
  -- Parcelas criadas juntas: mesmo group_id, "installment de installments".
  group_id uuid,
  installment int check (installment > 0),
  installments int check (installments > 0 and installments <= 120),
  notes text check (char_length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  last_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check ((status = 'pago') = (paid_at is not null and paid_amount is not null)),
  check (kind = 'receber' or customer_id is null),
  check (kind = 'pagar' or supplier_id is null),
  check (installment is null or installment <= installments),
  foreign key (customer_id, organization_id)
    references public.customers (id, organization_id) on delete restrict,
  foreign key (supplier_id, organization_id)
    references public.suppliers (id, organization_id) on delete set null (supplier_id),
  foreign key (sale_id, organization_id)
    references public.sales (id, organization_id) on delete restrict
);
create index financial_entries_org_due_idx on public.financial_entries (organization_id, kind, due_date);
create index financial_entries_org_paid_idx on public.financial_entries (organization_id, paid_at) where status = 'pago';
create index financial_entries_customer_idx on public.financial_entries (customer_id) where customer_id is not null;
create unique index financial_entries_sale_idx on public.financial_entries (sale_id) where sale_id is not null;

create trigger financial_entries_touch_updated_at before update on public.financial_entries
  for each row execute function public.touch_updated_at();
create trigger financial_entries_last_updated_by before insert or update on public.financial_entries
  for each row execute function public.set_last_updated_by();

-- ---------------------------------------------------------------------
-- RLS: só dono/administrador, nas quatro operações. Conta de venda não se
-- apaga (o vínculo some junto com o histórico).
-- ---------------------------------------------------------------------
alter table public.financial_entries enable row level security;

create policy org_admins_select on public.financial_entries for select
  using (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_insert on public.financial_entries for insert
  with check (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_update on public.financial_entries for update
  using (organization_id in (select public.user_admin_organization_ids()))
  with check (organization_id in (select public.user_admin_organization_ids()));
create policy org_admins_delete on public.financial_entries for delete
  using (organization_id in (select public.user_admin_organization_ids()) and sale_id is null);

-- O vínculo com a venda (sale_id) e o tipo só são gravados pelo banco.
revoke all on public.financial_entries from anon;
revoke insert, update on public.financial_entries from authenticated;
grant select, delete on public.financial_entries to authenticated;
grant insert (organization_id, kind, description, category, customer_id, supplier_id, amount,
              due_date, status, paid_at, paid_amount, payment_method, group_id, installment,
              installments, notes)
  on public.financial_entries to authenticated;
grant update (description, category, customer_id, supplier_id, amount, due_date, status,
              paid_at, paid_amount, payment_method, notes)
  on public.financial_entries to authenticated;

-- ---------------------------------------------------------------------
-- _record_sale: igual à versão anterior + conta a receber da venda fiado.
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

  -- Fiado vira conta a receber do cliente, com vencimento em 30 dias.
  if p_payment_method = 'fiado' and v_total > 0 then
    insert into public.financial_entries (
      organization_id, kind, description, category, customer_id, amount, due_date,
      sale_id, created_by
    ) values (
      p_organization_id, 'receber', 'Venda #' || v_number || ' (fiado)', 'Vendas', p_customer_id,
      v_total, (now() at time zone 'America/Sao_Paulo')::date + 30, v_sale.id, auth.uid()
    );
  end if;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- cancel_sale: igual à versão anterior + cancela a conta a receber do fiado
-- (recusa se ela já foi recebida: estornar o recebimento antes).
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
  if exists (
    select 1 from public.financial_entries
     where sale_id = v_sale.id and status = 'pago'
  ) then
    raise exception 'Esta venda fiado já foi recebida no financeiro: estorne o recebimento antes de cancelar.';
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

  update public.financial_entries
     set status = 'cancelado',
         notes = left(coalesce(notes || E'\n', '') || 'Venda cancelada: ' || btrim(p_reason), 1000)
   where sale_id = v_sale.id and status = 'aberto';

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

-- As duas continuam com as permissões de antes (create or replace mantém os
-- grants); reforço que a rotina interna segue fechada.
revoke all on function public._record_sale(uuid, jsonb, text, uuid, numeric, numeric, text)
  from public, anon, authenticated;
