# Solicitudes de Servicios + Correo

Este proyecto ya envía cada formulario a la tabla `service_requests` y luego invoca la Edge Function `send-service-request-email`.

## 1) Crear tabla y políticas

En Supabase SQL Editor ejecuta:

`supabase/sql/service_requests.sql`

## 2) Configurar proveedor de correo (Resend recomendado)

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

La función ya tiene `verify_jwt = false` en `config.toml` para permitir invocación desde formularios públicos.

## 4) Probar

1. Abre:
- `/servicios/planes`
- `/servicios/portabilidad`
- `/servicios/recuperacion`
2. Envía un formulario.
3. Verifica:
- se inserta en `public.service_requests`
- llega correo a `rodriguezlopezfernando26@gmail.com`.
