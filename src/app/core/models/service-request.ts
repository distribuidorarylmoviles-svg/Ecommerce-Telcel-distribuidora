export type ServiceType = 'planes' | 'portabilidad' | 'recuperacion';

export interface ServiceRequestInput {
  serviceType: ServiceType;
  nombre: string;
  correoElectronico?: string | null;
  telefonoCelular?: string | null;
  comentario?: string | null;
  payload?: Record<string, unknown>;
}

export interface ServiceRequestResult {
  success: boolean;
  emailSent: boolean;
  message: string;
  requestId?: string;
}
