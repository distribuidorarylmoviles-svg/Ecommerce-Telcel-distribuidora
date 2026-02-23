# Solicitudes de Servicios

Este proyecto registra cada formulario en `service_requests` y envía correo con Resend usando la Edge Function `send-service-request-email`.

## 1) Crear tabla y políticas

En Supabase SQL Editor ejecuta:

`supabase/sql/service_requests.sql`

## 2) Configurar proveedor de correo (Resend)

1. Crea una API key en Resend.
2. En Supabase CLI, en la raíz del repo:

```bash
supabase secrets set RESEND_API_KEY=tu_resend_api_key
supabase secrets set SERVICE_REQUESTS_FROM_EMAIL=notificaciones@tudominio.com
```

Notas:
- Si no defines `SERVICE_REQUESTS_FROM_EMAIL`, se usa `onboarding@resend.dev`.
- Para producción conviene usar un dominio verificado en Resend.

## 3) Desplegar la Edge Function

```bash
supabase functions deploy send-service-request-email
```

La función valida `reply_to` automáticamente. Si el correo del usuario no tiene formato válido, igual registra la solicitud y envía el correo sin `reply_to`.

## 4) Probar

1. Abre:
- `/servicios/planes`
- `/servicios/portabilidad`
- `/servicios/recuperacion`
2. Envía un formulario.
3. Verifica:
- se inserta en `public.service_requests`.
- `email_sent = true` en casos exitosos.

## 5) Panel admin (productos, compras, solicitudes)

Para que `/admin` pueda listar y editar datos desde cliente autenticado, ejecuta también:

`supabase/sql/admin_panel_policies.sql`

Esto crea la función `public.is_admin()` y políticas RLS para:
- `service_requests` (lectura y eliminación para admin)
- `products` (lectura pública y CRUD para admin)
- `categories` (lectura pública y CRUD para admin)
- `orders` y `order_items` (lectura para admin)

Nota: `is_admin()` valida con `auth.uid()` consultando `auth.users` (no depende del JWT en caché), revisa `user_metadata.rol` (`admin`/`super_admin`) y también permite el correo `rodriguezlopezfernando26@gmail.com` como respaldo.
