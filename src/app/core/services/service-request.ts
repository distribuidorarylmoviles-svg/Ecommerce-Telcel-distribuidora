import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { ServiceRequestInput, ServiceRequestResult } from '../models/service-request';

@Injectable({ providedIn: 'root' })
export class ServiceRequestService {
  private readonly destinationEmail = 'rodriguezlopezfernando26@gmail.com';

  constructor(
    private supabaseService: SupabaseService,
    private supabaseAuth: SupabaseAuthService,
  ) {}

  submitRequest(data: ServiceRequestInput): Observable<ServiceRequestResult> {
    return from(this.submitRequestInternal(data));
  }

  private async submitRequestInternal(data: ServiceRequestInput): Promise<ServiceRequestResult> {
    const supabase = this.supabaseService.getClient();
    const user = this.supabaseAuth.currentUser;

    const nombre = data.nombre.trim();
    const correoElectronico = (data.correoElectronico ?? '').trim().toLowerCase() || null;
    const telefonoCelular = (data.telefonoCelular ?? '').trim() || null;
    const comentario = (data.comentario ?? '').trim() || null;

    if (!nombre) {
      throw { error: { message: 'El nombre es obligatorio.' } };
    }

    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'send-service-request-email',
      {
        body: {
          to: this.destinationEmail,
          service_type: data.serviceType,
          nombre,
          correo_electronico: correoElectronico,
          telefono_celular: telefonoCelular,
          comentario,
          payload: data.payload ?? {},
          destination_email: this.destinationEmail,
          user_id: user?.id ?? null,
        },
      },
    );

    if (functionError) {
      throw { error: { message: functionError.message || 'No se pudo procesar la solicitud.' } };
    }

    const requestId = typeof functionData?.request_id === 'string' ? functionData.request_id : undefined;

    return {
      success: true,
      emailSent: true,
      requestId,
      message: 'Solicitud enviada correctamente. Te contactaremos pronto.',
    };
  }
}
