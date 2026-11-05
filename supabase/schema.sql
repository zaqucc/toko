-- Loji Express — Supabase schema
-- Jalankan seluruh file ini melalui Supabase Dashboard > SQL Editor.
-- Aman dijalankan ulang (IF NOT EXISTS / DROP POLICY IF EXISTS).

create extension if not exists pgcrypto;

-- Kategori produk
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  aktif boolean not null default true,
  urutan integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Produk. Kolom foto mengikuti struktur katalog lama dari Google Sheets.
create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  nama text not null,
  kategori text,
  harga numeric(14,2) not null default 0 check (harga >= 0),
  stok integer not null default 0 check (stok >= 0),
  deskripsi text not null default '',
  foto_1_url text,
  foto_2_url text,
  foto_3_url text,
  aktif boolean not null default true,
  urutan integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_kategori_idx on public.products (kategori);
create index if not exists products_aktif_urutan_idx on public.products (aktif, urutan);

-- Daftar admin: hanya user yang UUID-nya dimasukkan di sini yang boleh mengelola data.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_loji_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and aktif = true
  );
$$;

revoke all on function public.is_loji_admin() from public;
grant execute on function public.is_loji_admin() to anon, authenticated;

-- Pesanan dan snapshot item agar histori tetap benar walau nama/harga produk berubah.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  nomor_pesanan text not null unique,
  nama_pelanggan text not null,
  telepon_pelanggan text,
  alamat_pengiriman text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  jarak_km numeric(10,2),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  ongkir numeric(14,2) not null default 0 check (ongkir >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  status text not null default 'menunggu'
    check (status in ('menunggu','dikonfirmasi','diproses','dikirim','selesai','dibatalkan')),
  catatan text,
  sumber text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  nama_produk text not null,
  harga_satuan numeric(14,2) not null check (harga_satuan >= 0),
  jumlah integer not null check (jumlah > 0),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- Pengaturan toko (misalnya nomor WhatsApp dan koordinat toko).
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Aktifkan RLS pada semua tabel.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.store_settings enable row level security;

-- Katalog aktif dapat dibaca publik; perubahan hanya oleh admin.
drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
on public.categories for select to anon, authenticated
using (aktif = true or (select public.is_loji_admin()));

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
on public.categories for all to authenticated
using ((select public.is_loji_admin()))
with check ((select public.is_loji_admin()));

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select to anon, authenticated
using (aktif = true or (select public.is_loji_admin()));

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
on public.products for all to authenticated
using ((select public.is_loji_admin()))
with check ((select public.is_loji_admin()));

-- Akun admin hanya dapat melihat data admin miliknya sendiri.
drop policy if exists "Admins can read own admin record" on public.admin_users;
create policy "Admins can read own admin record"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_loji_admin()));

-- Data pesanan hanya dapat dibaca dan dikelola admin.
drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders"
on public.orders for all to authenticated
using ((select public.is_loji_admin()))
with check ((select public.is_loji_admin()));

drop policy if exists "Admins manage order items" on public.order_items;
create policy "Admins manage order items"
on public.order_items for all to authenticated
using ((select public.is_loji_admin()))
with check ((select public.is_loji_admin()));

drop policy if exists "Admins manage store settings" on public.store_settings;
create policy "Admins manage store settings"
on public.store_settings for all to authenticated
using ((select public.is_loji_admin()))
with check ((select public.is_loji_admin()));

-- Bucket foto produk: file dapat ditampilkan di katalog, upload/hapus hanya admin.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (select public.is_loji_admin()));

drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (select public.is_loji_admin()))
with check (bucket_id = 'product-images' and (select public.is_loji_admin()));

drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (select public.is_loji_admin()));

-- Catatan:
-- 1. Buat user admin melalui Authentication > Users terlebih dahulu.
-- 2. Setelah user dibuat, ambil UUID user tersebut lalu jalankan:
--    insert into public.admin_users (user_id, nama)
--    values ('UUID-USER-ADMIN', 'Admin Loji Express');
-- 3. Jangan pernah menaruh secret/service_role key di website.
-- 4. Endpoint order publik belum dibuka. Checkout akan dihubungkan melalui RPC
--    tervalidasi agar harga dan stok diperiksa di database sebelum pesanan disimpan.
