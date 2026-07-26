-- =====================================================================
--  Mon Amour — every detail a cart or product page will give us,
--  plus the bookkeeping price tracking needs.
-- =====================================================================

alter table public.products
  add column if not exists quantity        integer,
  add column if not exists seller          text,
  add column if not exists rating          numeric(3, 2),
  add column if not exists rating_count    integer,
  add column if not exists sku             text,
  add column if not exists availability    text,
  add column if not exists sizes_available text[] not null default '{}',
  -- Whether we keep re-checking this piece's price.
  add column if not exists tracking        boolean not null default true,
  add column if not exists last_checked_at timestamptz;

alter table public.products
  drop constraint if exists products_availability_check;
alter table public.products
  add constraint products_availability_check
  check (availability is null or availability in ('in_stock', 'low_stock', 'out_of_stock'));

-- The tracker walks this: oldest check first, only what is still watched.
create index if not exists products_tracking_idx
  on public.products (tracking, last_checked_at nulls first)
  where product_url is not null;

-- ---------------------------------------------------------------------
--  Read model — `p.*` so future columns arrive without touching this
-- ---------------------------------------------------------------------

drop view if exists public.products_expanded;

create view public.products_expanded
with (security_invoker = true) as
select
  p.*,
  exists (
    select 1 from public.favorites f
    where f.product_id = p.id and f.user_id = p.user_id
  ) as favorite,
  coalesce(
    (
      select array_agg(cp.collection_id)
      from public.collection_products cp
      where cp.product_id = p.id
    ),
    '{}'::uuid[]
  ) as collection_ids,
  coalesce(
    (
      select jsonb_agg(
               jsonb_build_object('price', ph.price, 'recordedAt', ph.recorded_at)
               order by ph.recorded_at
             )
      from public.price_history ph
      where ph.product_id = p.id
    ),
    '[]'::jsonb
  ) as price_history
from public.products p;

-- ---------------------------------------------------------------------
--  Price tracking also stamps last_checked_at, so a re-check that finds
--  no change still counts as a check.
-- ---------------------------------------------------------------------

create or replace function public.record_price_check(
  target_id uuid,
  observed_price numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.products
     set price           = coalesce(observed_price, price),
         last_checked_at = now()
   where id = target_id
     and user_id = auth.uid();
end;
$$;
