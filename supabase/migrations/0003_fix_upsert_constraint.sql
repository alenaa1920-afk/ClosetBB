-- =====================================================================
--  Mon Amour — make the product upsert actually work
--
--  0001 created `products_user_url_key` as a PARTIAL unique index:
--
--      create unique index ... on products (user_id, product_url)
--        where product_url is not null;
--
--  Postgres will only use a partial index as an ON CONFLICT arbiter when the
--  statement repeats the predicate (`on conflict (a, b) where ...`), and
--  PostgREST never emits that. So every insert through the API failed with
--
--      42P10  there is no unique or exclusion constraint matching the
--             ON CONFLICT specification
--
--  A plain unique constraint has no such requirement. NULLs are distinct in
--  Postgres by default, so pieces saved without a link are still unlimited —
--  which is the behaviour the partial index was reaching for anyway.
-- =====================================================================

drop index if exists public.products_user_url_key;

alter table public.products
  drop constraint if exists products_user_url_key;

alter table public.products
  add constraint products_user_url_key unique (user_id, product_url);
