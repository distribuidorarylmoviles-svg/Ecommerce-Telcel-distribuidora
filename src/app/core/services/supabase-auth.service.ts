import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SupabaseAuthService {
  private supabase: SupabaseClient;
  private _session$ = new BehaviorSubject<Session | null>(null);

  // Observable para que los componentes se suscriban a los cambios de sesión
  session$: Observable<Session | null> = this._session$.asObservable();

  constructor(private supabaseService: SupabaseService) {
    // 1. Inicializar el cliente de Supabase aquí para evitar errores
    this.supabase = this.supabaseService.getClient();

    // 2. Cargar la sesión inicial al arrancar el servicio
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this._session$.next(session);
    });

    // 3. Escuchar cambios en el estado de autenticación y actualizar el BehaviorSubject
    this.supabase.auth.onAuthStateChange((event, session) => {
      this._session$.next(session);
    });
  }

  // Inicia sesión con email y password
  async login(credentials: { email: string, password: string }) {
    return this.supabase.auth.signInWithPassword(credentials);
  }

  // Registrar un nuevo usuario
  async signUp(credentials: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
    return this.supabase.auth.signUp(credentials);
  }

  // Envía un código OTP al correo existente para recuperar contraseña
  async sendPasswordResetCode(email: string) {
    return this.supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
  }

  // Valida OTP por correo y abre sesión temporal para permitir cambio de contraseña
  async verifyEmailOtp(email: string, token: string) {
    return this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
  }

  // Envía correo de recuperación de contraseña con redirect configurado
  async sendPasswordResetEmail(email: string, redirectTo: string) {
    return this.supabase.auth.resetPasswordForEmail(email, { redirectTo });
  }

  // Actualiza contraseña del usuario autenticado
  async updatePassword(password: string) {
    return this.supabase.auth.updateUser({ password });
  }

  // Guarda/actualiza teléfono del usuario autenticado
  async updatePhone(phone: string) {
    return this.supabase.auth.updateUser({ phone });
  }

  // Cierra la sesión del usuario
  async logout() {
    return this.supabase.auth.signOut();
  }

  // Obtiene el token de la sesión actual para el interceptor
  async getToken(): Promise<string | null> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  // Un método útil para saber si el usuario está logueado (sincrónico)
  isLoggedIn(): boolean {
    return !!this._session$.getValue();
  }

  // Obtener el usuario actual de forma síncrona
  get currentUser(): User | undefined {
    return this._session$.getValue()?.user;
  }
}
