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

function getCarrierTrackingUrl(carrier: string, trackingNumber: string): string {
  const c = carrier.toUpperCase();
  if (c === 'FEDEX')        return `https://www.fedex.com/apps/fedextrack/?action=track&trackingnumber=${trackingNumber}`;
  if (c === 'DHL')          return `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${trackingNumber}`;
  if (c === 'ESTAFETA')     return `https://www.estafeta.com/herramientas/rastreo?wayBillType=1&wayBill=${trackingNumber}`;
  if (c === 'REDPACK')      return `https://www.redpack.com.mx/es/rastreo/?guias=${trackingNumber}`;
  if (c === 'PAQUETEXPRESS') return `https://www.paquetexpress.com.mx/rastreo?guia=${trackingNumber}`;
  if (c === 'UPS')          return `https://www.ups.com/track?loc=es_MX&tracknum=${trackingNumber}`;
  if (c === 'CARSSA')       return `https://www.grupocarssa.com/new/${trackingNumber}`;
  return `https://www.google.com/search?q=rastreo+${c}+${trackingNumber}`;
}

function simulatedTracking(carrier: string, trackingNumber: string) {
  const events: TrackingEvent[] = [
    {
      status: 'CREATED',
      date: '2026-03-10T09:00:00-06:00',
      description: 'Paquete registrado en sistema',
      location: 'Chilapa de Álvarez, Guerrero',
    },
    {
      status: 'PICKED_UP',
      date: '2026-03-11T11:30:00-06:00',
      description: 'Paquete recolectado por el carrier',
      location: 'Chilapa de Álvarez, Guerrero',
    },
    {
      status: 'IN_TRANSIT',
      date: '2026-03-12T08:15:00-06:00',
      description: 'En tránsito hacia centro de distribución',
      location: 'Chilpancingo, Guerrero',
    },
    {
      status: 'IN_TRANSIT',
      date: '2026-03-13T14:00:00-06:00',
      description: 'Llegó a centro de distribución',
      location: 'Ciudad de México, CDMX',
    },
    {
      status: 'LAST_MILE',
      date: '2026-03-14T07:45:00-06:00',
      description: 'En camino al domicilio del destinatario',
      location: 'Ciudad de México, CDMX',
    },
  ];

  return {
    ok: true,
    trackingNumber,
    carrier: carrier.toUpperCase(),
    status: 'LAST_MILE',
    trackingUrl: getCarrierTrackingUrl(carrier, trackingNumber),
    events,
    source: 'simulation',
  };
}

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

    // ── Simulación para número de prueba ─────────────────────────────────────
    if (trackingNumber === '000000') {
      return new Response(
        JSON.stringify(simulatedTracking(carrier, trackingNumber)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Guías reales: devolver URL del carrier ────────────────────────────────
    return new Response(
      JSON.stringify({
        ok: true,
        trackingNumber,
        carrier: carrier.toUpperCase(),
        status: 'UNKNOWN',
        trackingUrl: getCarrierTrackingUrl(carrier, trackingNumber),
        events: [],
        source: 'carrier_url',
      }),
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
