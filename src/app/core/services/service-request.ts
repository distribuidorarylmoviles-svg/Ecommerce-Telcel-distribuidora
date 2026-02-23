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
    const correoNormalizado = (data.correoElectronico ?? '').trim().toLowerCase();
    const correoElectronico =
      correoNormalizado && this.isValidEmail(correoNormalizado) ? correoNormalizado : null;
    const telefonoCelular = (data.telefonoCelular ?? '').trim() || null;
    const comentario = (data.comentario ?? '').trim() || null;

    if (!nombre) {
      throw { error: { message: 'El nombre es obligatorio.' } };
    }

    const { data: invokeData, error } = await supabase.functions.invoke('send-service-request-email', {
      body: {
        service_type: data.serviceType,
        nombre,
        correo_electronico: correoElectronico,
        telefono_celular: telefonoCelular,
        comentario,
        payload: data.payload ?? {},
        destination_email: this.destinationEmail,
        user_id: user?.id ?? null,
      },
    });

    if (error) {
      const functionMessage = await this.extractFunctionError(error);
      throw { error: { message: functionMessage || error.message || 'No se pudo enviar la solicitud.' } };
    }

    const response = invokeData as
      | {
          ok?: boolean;
          request_id?: string;
          email_sent?: boolean;
          error?: string;
        }
      | null
      | undefined;

    const requestId =
      response && typeof response.request_id === 'string'
        ? response.request_id
        : undefined;

    if (response?.ok === false) {
      return {
        success: true,
        emailSent: false,
        requestId,
        message: 'Solicitud registrada, pero el correo no se pudo enviar en este momento.',
      };
    }

    return {
      success: true,
      emailSent: response?.email_sent ?? true,
      requestId,
      message: 'Solicitud enviada correctamente. Te contactaremos pronto.',
    };
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private async extractFunctionError(error: unknown): Promise<string | null> {
    const maybeError = error as {
      message?: string;
      context?: {
        json?: () => Promise<unknown>;
        text?: () => Promise<string>;
      };
    };

    if (maybeError?.context?.json) {
      try {
        const body = await maybeError.context.json();
        if (body && typeof body === 'object') {
          const message = (body as { error?: unknown }).error;
          if (typeof message === 'string' && message.trim()) {
            return message;
          }
        }
      } catch {
        // Ignorar errores de parseo de cuerpo.
      }
    }

    if (maybeError?.context?.text) {
      try {
        const body = await maybeError.context.text();
        if (body.trim()) return body;
      } catch {
        // Ignorar errores de lectura de cuerpo.
      }
    }

    if (typeof maybeError?.message === 'string' && maybeError.message.trim()) {
      return maybeError.message;
    }

    return null;
  }
}
