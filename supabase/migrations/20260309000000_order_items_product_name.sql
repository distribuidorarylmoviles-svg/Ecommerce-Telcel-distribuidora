-- Agrega columna product_name a order_items para guardar el nombre del producto
-- al momento de la compra. Esto permite recuperar el nombre aunque el producto
-- sea eliminado o no tenga product_id asociado.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name text;
