-- Migración: papelera de reciclaje (soft delete)
-- Ejecutar en: Supabase SQL Editor > New query

-- 1. Agregar columna deleted_at a las tres tablas
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Índices para acelerar los filtros .is('deleted_at', null)
CREATE INDEX IF NOT EXISTS idx_products_deleted_at
  ON public.products (deleted_at);

CREATE INDEX IF NOT EXISTS idx_categories_deleted_at
  ON public.categories (deleted_at);

CREATE INDEX IF NOT EXISTS idx_service_requests_deleted_at
  ON public.service_requests (deleted_at);

-- 3. Corregir FK de order_items → products para que al eliminar
--    permanentemente un producto los registros de order_items queden
--    con product_id = NULL (en lugar de lanzar un error de FK).
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products (id)
    ON DELETE SET NULL;

-- 4. Políticas RLS para soft delete (UPDATE) en service_requests.
--    El hard delete anterior usaba DELETE; el soft delete usa UPDATE.
--    Sin política de UPDATE el cambio se silencia sin error.
--
--    Admin se identifica por user_metadata.rol o por email hardcodeado.

DROP POLICY IF EXISTS "Admin puede actualizar service_requests" ON public.service_requests;

CREATE POLICY "Admin puede actualizar service_requests"
  ON public.service_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'super_admin')
    OR auth.email() = 'rodriguezlopezfernando26@gmail.com'
  )
  WITH CHECK (true);

-- 5. Políticas equivalentes para products y categories (por si tampoco existían).

DROP POLICY IF EXISTS "Admin puede actualizar products" ON public.products;

CREATE POLICY "Admin puede actualizar products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'super_admin')
    OR auth.email() = 'rodriguezlopezfernando26@gmail.com'
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin puede actualizar categories" ON public.categories;

CREATE POLICY "Admin puede actualizar categories"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'super_admin')
    OR auth.email() = 'rodriguezlopezfernando26@gmail.com'
  )
  WITH CHECK (true);
