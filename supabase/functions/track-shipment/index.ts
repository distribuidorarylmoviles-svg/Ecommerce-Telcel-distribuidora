const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SkydropxTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SkydropxEvent = {
  status: string;
  description: string | null;
  location: string | null;
  created_at: string | null;
};

type SkydropxTracking = {
  id: string;
  type: string;
  attributes: {
    tracking_number: string;
    status: string | null;
    carrier_name: string | null;
    tracking_events: SkydropxEvent[];
  };
};

type SkydropxResponse = {
  data: SkydropxTracking[];
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { tracking_number?: string };
    const trackingNumber = body.tracking_number?.trim();

    if (!trackingNumber) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El número de guía es requerido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const clientId = Deno.env.get('SKYDROPX_API_KEY');
    const clientSecret = Deno.env.get('SKYDROPX_SECRET_KEY');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Credenciales de Skydropx no configuradas en el servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 1. Obtener token OAuth2 ──────────────────────────────────────────────
    const tokenRes = await fetch('https://api.skydropx.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      console.error('Skydropx token error:', tokenErr);
      return new Response(
        JSON.stringify({ ok: false, error: `Error de autenticación con Skydropx: ${tokenRes.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenData = await tokenRes.json() as SkydropxTokenResponse;
    const accessToken = tokenData.access_token;

    // ── 2. Consultar rastreo ─────────────────────────────────────────────────
    const trackRes = await fetch(
      `https://api.skydropx.com/v1/trackings?tracking_number=${encodeURIComponent(trackingNumber)}`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
    );

    const trackText = await trackRes.text();

    if (!trackRes.ok) {
      console.error('Skydropx track error:', trackText);
      return new Response(
        JSON.stringify({ ok: false, error: `Error al consultar Skydropx: ${trackRes.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const trackData = JSON.parse(trackText) as SkydropxResponse;

    return new Response(
      JSON.stringify({ ok: true, data: trackData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('track-shipment error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
