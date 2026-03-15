-- Agrega columnas de rastreo Skydropx a la tabla orders.
-- Todas usan IF NOT EXISTS para ser seguras en entornos donde ya existan.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS shipment_id text,
  ADD COLUMN IF NOT EXISTS shipping_rate numeric,
  ADD COLUMN IF NOT EXISTS estimated_delivery_days integer,
  ADD COLUMN IF NOT EXISTS tracking_url text;
