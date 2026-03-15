const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TrackingEvent = {
  status: string | null;
  date: string | null;
  description: string | null;
  location: string | null;
};

type TrackingRecord = {
  id?: string;
  tracking_number?: string;
  status?: string;
  events?: TrackingEvent[];
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { tracking_number?: string; carrier?: string };
    const trackingNumber = body.tracking_number?.trim();
    const carrier = body.carrier?.trim();

    if (!trackingNumber || !carrier) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El número de guía y el carrier son requeridos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('SKYDROPX_API_KEY');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'API key de Skydropx no configurada.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Consultar rastreo Skydropx Radar API ────────────────────────────────
    const trackRes = await fetch('https://radar-api.skydropx.com/v1/tracking', {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tracking_numbers: [{ carrier, tracking_number: trackingNumber }],
      }),
    });

    const trackText = await trackRes.text();

    if (!trackText || trackText.trim() === '') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Respuesta vacía de Skydropx.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!trackRes.ok) {
      console.error('Skydropx error:', trackText);
      return new Response(
        JSON.stringify({ ok: false, error: `Error de Skydropx (${trackRes.status}): ${trackText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const trackData = JSON.parse(trackText) as TrackingRecord | TrackingRecord[];

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
