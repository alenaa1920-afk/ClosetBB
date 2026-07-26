-- =====================================================================
--  Mon Amour — initial schema
--
--  Everything is scoped to the signed-in person by row-level security, so
--  the wardrobe is private even though the anon key is public.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  Profiles
-- ---------------------------------------------------------------------

create table if not exists public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users read own profile" on public.users;
create policy "users read own profile"
  on public.users for select using (auth.uid() = id);

drop policy if exists "users update own profile" on public.users;
create policy "users update own profile"
  on public.users for update using (auth.uid() = id);

-- Mirror every new auth user into the profile table.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
--  Stores — reference data, readable by everyone
-- ---------------------------------------------------------------------

create table if not exists public.stores (
  key              text primary key,
  label            text not null,
  color            text not null,
  color_dark       text,
  gradient_from    text,
  gradient_to      text,
  home             text,
  extension_status text not null default 'planned'
    check (extension_status in ('live', 'planned'))
);

alter table public.stores enable row level security;

drop policy if exists "stores are readable" on public.stores;
create policy "stores are readable"
  on public.stores for select using (true);

insert into public.stores (key, label, color, color_dark, gradient_from, gradient_to, home, extension_status) values
  ('myntra',  'Myntra',   '#ff3f6c', null,      null,      null,      'https://www.myntra.com',  'live'),
  ('savana',  'Savana',   '#7c3aed', null,      null,      null,      'https://www.savana.com',  'live'),
  ('zara',    'Zara',     '#111827', '#e7e5e4', null,      null,      'https://www.zara.com',    'live'),
  ('hm',      'H&M',      '#e50010', null,      null,      null,      'https://www2.hm.com',     'live'),
  ('ajio',    'Ajio',     '#2563eb', null,      null,      null,      'https://www.ajio.com',    'live'),
  ('urbanic', 'Urbanic',  '#a78bfa', null,      null,      null,      'https://www.urbanic.com', 'live'),
  ('nykaa',   'Nykaa',    '#fc2779', null,      '#fc2779', '#ff8ab5', 'https://www.nykaa.com',   'live'),
  ('other',   'Boutique', '#f472b6', null,      null,      null,      '',                        'planned')
on conflict (key) do update set
  label            = excluded.label,
  color            = excluded.color,
  color_dark       = excluded.color_dark,
  gradient_from    = excluded.gradient_from,
  gradient_to      = excluded.gradient_to,
  home             = excluded.home,
  extension_status = excluded.extension_status;

-- ---------------------------------------------------------------------
--  Products
-- ---------------------------------------------------------------------

create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  title          text not null,
  brand          text,
  store          text not null default 'other' references public.stores (key),
  category       text not null default 'others',
  price          numeric(12, 2),
  original_price numeric(12, 2),
  currency       text not null default 'INR',
  discount       integer,
  image_url      text,
  product_url    text,
  size           text,
  color          text,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One entry per product link per person; the extension relies on this to
-- refresh a price instead of duplicating the piece.
--
-- A plain constraint, not a partial index: ON CONFLICT can only use a partial
-- index when the statement repeats its predicate, which PostgREST never does.
-- NULLs are distinct by default, so pieces without a link are unrestricted.
alter table public.products
  drop constraint if exists products_user_url_key;
alter table public.products
  add constraint products_user_url_key unique (user_id, product_url);

create index if not exists products_user_created_idx
  on public.products (user_id, created_at desc);
create index if not exists products_user_store_idx on public.products (user_id, store);
create index if not exists products_user_category_idx on public.products (user_id, category);

alter table public.products enable row level security;

drop policy if exists "products are private" on public.products;
create policy "products are private"
  on public.products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
--  Collections
-- ---------------------------------------------------------------------

create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  name       text not null,
  emoji      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.collections enable row level security;

drop policy if exists "collections are private" on public.collections;
create policy "collections are private"
  on public.collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, product_id)
);

create index if not exists collection_products_product_idx
  on public.collection_products (product_id);

alter table public.collection_products enable row level security;

drop policy if exists "collection links follow the collection" on public.collection_products;
create policy "collection links follow the collection"
  on public.collection_products for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
--  Favourites
-- ---------------------------------------------------------------------

create table if not exists public.favorites (
  user_id    uuid not null references public.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites are private" on public.favorites;
create policy "favorites are private"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
--  Price history — every figure we have ever seen for a piece
-- ---------------------------------------------------------------------

create table if not exists public.price_history (
  id          bigserial primary key,
  product_id  uuid not null references public.products (id) on delete cascade,
  price       numeric(12, 2) not null,
  recorded_at timestamptz not null default now()
);

create index if not exists price_history_product_idx
  on public.price_history (product_id, recorded_at);

alter table public.price_history enable row level security;

drop policy if exists "price history follows the product" on public.price_history;
create policy "price history follows the product"
  on public.price_history for all
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.user_id = auth.uid()
    )
  );

-- Record the opening price, and every change after it.
create or replace function public.track_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.price is not null then
      insert into public.price_history (product_id, price) values (new.id, new.price);
    end if;
    return new;
  end if;

  new.updated_at := now();

  if new.price is not null and (old.price is null or new.price <> old.price) then
    insert into public.price_history (product_id, price) values (new.id, new.price);
  end if;

  return new;
end;
$$;

drop trigger if exists products_price_insert on public.products;
create trigger products_price_insert
  after insert on public.products
  for each row execute function public.track_price();

drop trigger if exists products_price_update on public.products;
create trigger products_price_update
  before update on public.products
  for each row execute function public.track_price();

-- ---------------------------------------------------------------------
--  Read model — one round trip for the whole wardrobe
-- ---------------------------------------------------------------------

create or replace view public.products_expanded
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.title,
  p.brand,
  p.store,
  p.category,
  p.price,
  p.original_price,
  p.currency,
  p.discount,
  p.image_url,
  p.product_url,
  p.size,
  p.color,
  p.note,
  p.created_at,
  p.updated_at,
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
--  Storage — mirrored product imagery
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product images are readable" on storage.objects;
create policy "product images are readable"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "own folder uploads" on storage.objects;
create policy "own folder uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own folder deletes" on storage.objects;
create policy "own folder deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
