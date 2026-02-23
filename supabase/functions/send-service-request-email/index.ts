import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ServiceRequestRow = {
  id: string;
  service_type: 'planes' | 'portabilidad' | 'recuperacion';
  nombre: string;
  correo_electronico: string | null;
  telefono_celular: string | null;
  comentario: string | null;
  payload: Record<string, unknown> | null;
  destination_email: string;
  created_at: string;
};

const validServiceTypes = new Set(['planes', 'portabilidad', 'recuperacion']);
const defaultDestinationEmail = 'rodriguezlopezfernando26@gmail.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function formatPayload(payload: Record<string, unknown> | null): string {
  if (!payload || Object.keys(payload).length === 0) return '<p>Sin detalles adicionales.</p>';

  const rows = Object.entries(payload)
    .map(([key, value]) => {
      const safeKey = escapeHtml(key);
      const safeValue = escapeHtml(value === null ? 'null' : String(value));
      return `<tr><td style="padding:6px 10px;border:1px solid #dbe4ee;"><strong>${safeKey}</strong></td><td style="padding:6px 10px;border:1px solid #dbe4ee;">${safeValue}</td></tr>`;
    })
    .join('');

  return `<table style="width:100%;border-collapse:collapse;margin-top:8px;">${rows}</table>`;
}

function serviceLabel(serviceType: ServiceRequestRow['service_type']): string {
  if (serviceType === 'planes') return 'Planes de Internet';
  if (serviceType === 'portabilidad') return 'Portabilidad';
  return 'Recuperación de Número';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('SERVICE_REQUESTS_FROM_EMAIL') ?? 'onboarding@resend.dev';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing RESEND_API_KEY or Supabase service env vars.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const { request_id, to } = body;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let requestRow: ServiceRequestRow | null = null;

    if (typeof request_id === 'string' && request_id.trim()) {
      const { data: existingRow, error: fetchError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', request_id.trim())
        .single<ServiceRequestRow>();

      if (fetchError || !existingRow) {
        return new Response(
          JSON.stringify({ error: fetchError?.message ?? 'Request not found.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      requestRow = existingRow;
    } else {
      const serviceType = String(body.service_type ?? '').trim();
      const nombre = String(body.nombre ?? '').trim();
      const correoElectronicoRaw =
        typeof body.correo_electronico === 'string' && body.correo_electronico.trim()
          ? body.correo_electronico.trim().toLowerCase()
          : null;
      const correoElectronico =
        correoElectronicoRaw && isValidEmail(correoElectronicoRaw) ? correoElectronicoRaw : null;
      const telefonoCelular =
        typeof body.telefono_celular === 'string' && body.telefono_celular.trim()
          ? body.telefono_celular.trim()
          : null;
      const comentario =
        typeof body.comentario === 'string' && body.comentario.trim() ? body.comentario.trim() : null;
      const payload =
        typeof body.payload === 'object' && body.payload !== null
          ? (body.payload as Record<string, unknown>)
          : {};
      const userId = typeof body.user_id === 'string' && body.user_id.trim() ? body.user_id.trim() : null;
      const destinationEmailFromBody =
        typeof body.destination_email === 'string' && body.destination_email.trim()
          ? body.destination_email.trim()
          : null;

      if (!validServiceTypes.has(serviceType)) {
        return new Response(JSON.stringify({ error: 'service_type inválido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!nombre) {
        return new Response(JSON.stringify({ error: 'nombre es obligatorio.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: insertedRow, error: insertError } = await supabase
        .from('service_requests')
        .insert({
          service_type: serviceType,
          nombre,
          correo_electronico: correoElectronico,
          telefono_celular: telefonoCelular,
          comentario,
          payload,
          destination_email: destinationEmailFromBody ?? defaultDestinationEmail,
          user_id: userId,
        })
        .select('*')
        .single<ServiceRequestRow>();

      if (insertError || !insertedRow) {
        return new Response(JSON.stringify({ error: insertError?.message ?? 'No se pudo insertar solicitud.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      requestRow = insertedRow;
    }

    const destinationCandidate = typeof to === 'string' && to.trim() ? to.trim() : requestRow.destination_email;
    const destination = isValidEmail(destinationCandidate) ? destinationCandidate : defaultDestinationEmail;
    const subject = `Nueva solicitud de servicio: ${serviceLabel(requestRow.service_type)}`;
    
    // Ensure replyTo is ONLY the email address to avoid Resend validation errors
    const replyTo = requestRow.correo_electronico && isValidEmail(requestRow.correo_electronico)
      ? requestRow.correo_electronico.trim()
      : undefined;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#102a43;">
        <h2 style="margin:0 0 10px;color:#0033a0;">Nueva solicitud de servicio</h2>
        <p><strong>Servicio:</strong> ${escapeHtml(serviceLabel(requestRow.service_type))}</p>
        <p><strong>Nombre:</strong> ${escapeHtml(requestRow.nombre)}</p>
        <p><strong>Correo:</strong> ${escapeHtml(requestRow.correo_electronico ?? 'No capturado')}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(requestRow.telefono_celular ?? 'No capturado')}</p>
        <p><strong>Comentario:</strong> ${escapeHtml(requestRow.comentario ?? 'Sin comentario')}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(requestRow.created_at)}</p>
        <h3 style="margin:18px 0 8px;color:#0033a0;">Detalles adicionales</h3>
        ${formatPayload(requestRow.payload)}
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [destination],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const resendBody = await resendResponse.text();
    if (!resendResponse.ok) {
      await supabase
        .from('service_requests')
        .update({ email_sent: false, email_error: resendBody })
        .eq('id', requestRow.id);

      return new Response(JSON.stringify({ ok: false, request_id: requestRow.id, email_sent: false, error: resendBody }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase
      .from('service_requests')
      .update({ email_sent: true, email_error: null })
      .eq('id', requestRow.id);

    return new Response(JSON.stringify({ ok: true, request_id: requestRow.id, email_sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
