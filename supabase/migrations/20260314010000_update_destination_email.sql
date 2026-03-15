-- Actualiza el email destino de solicitudes de servicio
UPDATE public.service_requests
SET destination_email = 'distribuidorarylmoviles@gmail.com'
WHERE destination_email = 'rodriguezlopezfernando26@gmail.com';

-- Cambia el default para nuevas solicitudes
ALTER TABLE public.service_requests
ALTER COLUMN destination_email SET DEFAULT 'distribuidorarylmoviles@gmail.com';
