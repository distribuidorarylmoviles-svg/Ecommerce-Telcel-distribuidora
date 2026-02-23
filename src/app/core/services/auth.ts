import { Injectable, signal, computed, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, from, map, throwError } from 'rxjs';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseService } from './supabase.service';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '../models/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser = signal<User | null>(null);
  private permissions = signal<string[]>([]);
  private loading = signal(false);

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isAdmin = computed(() => {
    const u = this.currentUser();
    const email = (u?.correo ?? '').trim().toLowerCase();
    return u?.rol === 'admin' || u?.rol === 'super_admin' || email === 'rodriguezlopezfernando26@gmail.com';
  });
  readonly isLoading = this.loading.asReadonly();

  constructor(
    private supabaseAuth: SupabaseAuthService,
    private supabaseService: SupabaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.checkSession();
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    const correo = credentials.correo.trim().toLowerCase();
    const contrasena = credentials.contrasena;
    if (!correo || !contrasena) {
      return throwError(() => this.createUiError('Correo y contraseña son obligatorios.'));
    }

    this.loading.set(true);
    return from(
      this.supabaseAuth.login({
        email: correo,
        password: contrasena,
      }),
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          throw this.createUiError(this.mapSupabaseLoginError(error.message));
        }

        if (!data.user) {
          throw this.createUiError('No se recibió información de usuario.');
        }

        const user = this.mapSupabaseUser(data.user);
        this.currentUser.set(user);
        this.permissions.set([]);
        this.syncPhoneFromMetadata(data.user);

        return {
          success: true,
          message: 'Inicio de sesión exitoso',
          user,
          permisos: [],
        };
      }),
      catchError((err: unknown) =>
        throwError(() => this.normalizeAuthError(err, 'Error al iniciar sesión')),
      ),
      finalize(() => this.loading.set(false)),
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    this.loading.set(true);
    return from(this.registerWithProfile(data)).pipe(
      catchError((err: unknown) =>
        throwError(() => this.normalizeAuthError(err, 'Error al registrarse')),
      ),
      finalize(() => this.loading.set(false)),
    );
  }

  requestPasswordResetCode(correo: string): Observable<{ success: boolean; message: string }> {
    const email = correo.trim().toLowerCase();
    if (!email) {
      return throwError(() => this.createUiError('El correo es obligatorio.'));
    }

    if (!isPlatformBrowser(this.platformId)) {
      return throwError(() => this.createUiError('La recuperación de contraseña solo está disponible en navegador.'));
    }

    const redirectTo = `${window.location.origin}/restablecer-contrasena`;

    this.loading.set(true);
    return from(this.supabaseAuth.sendPasswordResetEmail(email, redirectTo)).pipe(
      map(({ error }) => {
        if (error) {
          throw this.createUiError(this.mapSupabaseOtpError(error.message));
        }
        return {
          success: true,
          message: 'Te enviamos un enlace para restablecer tu contraseña a tu correo.',
        };
      }),
      catchError((err: unknown) =>
        throwError(() => this.normalizeAuthError(err, 'No se pudo enviar el correo de recuperación.')),
      ),
      finalize(() => this.loading.set(false)),
    );
  }

  updateRecoveredPassword(nuevaContrasena: string, confirmarContrasena: string): Observable<{ success: boolean; message: string }> {
    const nueva = nuevaContrasena.trim();
    const confirmar = confirmarContrasena.trim();
    if (nueva.length < 6) {
      return throwError(() => this.createUiError('La nueva contraseña debe tener al menos 6 caracteres.'));
    }
    if (nueva !== confirmar) {
      return throwError(() => this.createUiError('Las contraseñas no coinciden.'));
    }

    this.loading.set(true);
    return from(this.supabaseAuth.updatePassword(nueva)).pipe(
      map(({ error }) => {
        if (error) {
          throw this.createUiError(this.mapSupabasePasswordUpdateError(error.message));
        }
        return {
          success: true,
          message: 'Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.',
        };
      }),
      catchError((err: unknown) =>
        throwError(() => this.normalizeAuthError(err, 'No se pudo restablecer la contraseña.')),
      ),
      finalize(() => this.loading.set(false)),
    );
  }

  logout(): void {
    this.currentUser.set(null);
    this.permissions.set([]);
    void this.supabaseAuth.logout().finally(() => {
      this.router.navigate(['/login']);
    });
  }

  checkSession(): void {
    this.supabaseAuth.session$.subscribe({
      next: (session) => {
        if (!session?.user) {
          this.currentUser.set(null);
          this.permissions.set([]);
          return;
        }
        this.currentUser.set(this.mapSupabaseUser(session.user));
        this.permissions.set([]);
      },
    });
  }

  hasPermission(permiso: string): boolean {
    return this.permissions().includes(permiso);
  }

  private async registerWithProfile(data: RegisterRequest): Promise<AuthResponse> {
    const correo = data.correo.trim().toLowerCase();
    const telefono = this.normalizePhone(data.telefono);
    const contrasena = data.contrasena.trim();

    if (!correo) {
      throw this.createUiError('El correo es obligatorio.');
    }

    if (!telefono) {
      throw this.createUiError('El celular no es valido. Usa formato 5512345678 o +525512345678.');
    }

    if (contrasena.length < 6) {
      throw this.createUiError('La contraseña debe tener al menos 6 caracteres.');
    }

    if (contrasena !== data.confirmar_contrasena) {
      throw this.createUiError('Las contraseñas no coinciden.');
    }

    const { data: signUpData, error } = await this.supabaseAuth.signUp({
      email: correo,
      password: contrasena,
      options: {
        data: {
          nombre: data.nombre,
          apellido_paterno: data.apellido_paterno,
          apellido_materno: data.apellido_materno,
          telefono,
          rol: 'cliente',
        },
      },
    });

    if (error) {
      throw this.createUiError(this.mapSupabaseRegisterError(error.message));
    }

    const hasSession = Boolean(signUpData.session);
    if (signUpData.user && hasSession) {
      const { error: phoneError } = await this.supabaseAuth.updatePhone(telefono);
      if (phoneError) {
        console.warn(`No se pudo guardar telefono auth en registro: ${phoneError.message}`);
      }

      const supabase = this.supabaseService.getClient();
      const fullName = `${data.nombre} ${data.apellido_paterno} ${data.apellido_materno}`.replace(/\s+/g, ' ').trim();

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: signUpData.user.id,
          full_name: fullName,
          address: null,
          phone: telefono,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        console.warn(`No se pudo guardar profile en registro: ${profileError.message}`);
      }
    }

    const user = signUpData.user ? this.mapSupabaseUser(signUpData.user) : undefined;
    if (user) {
      this.currentUser.set(user);
      this.permissions.set([]);
    }

    return {
      success: true,
      message: hasSession
        ? 'Registro exitoso'
        : 'Registro exitoso. Revisa tu correo para confirmar tu cuenta.',
      user,
      permisos: [],
    };
  }

  private mapSupabaseUser(supabaseUser: SupabaseUser): User {
    const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
    return {
      id_u: this.numberFromMeta(metadata['id_u']),
      nombre: this.stringFromMeta(metadata['nombre']),
      apellido_paterno: this.stringFromMeta(metadata['apellido_paterno']),
      apellido_materno: this.stringFromMeta(metadata['apellido_materno']),
      correo: supabaseUser.email ?? '',
      rol: this.roleFromMeta(metadata['rol']),
      email_verified: Boolean(supabaseUser.email_confirmed_at),
      ultimo_acceso: supabaseUser.last_sign_in_at ?? undefined,
    };
  }

  private normalizeAuthError(err: unknown, fallbackMessage: string): { error: { message: string } } {
    if (this.isUiError(err)) {
      return err;
    }
    if (err instanceof Error && err.message) {
      return this.createUiError(err.message);
    }
    return this.createUiError(fallbackMessage);
  }

  private createUiError(message: string): { error: { message: string } } {
    return { error: { message } };
  }

  private mapSupabaseRegisterError(message?: string): string {
    const raw = (message || '').toLowerCase();
    if (raw.includes('user already registered')) {
      return 'Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.';
    }
    if (raw.includes('phone') && raw.includes('registered')) {
      return 'Ese celular ya está registrado.';
    }
    if (raw.includes('invalid') && raw.includes('phone')) {
      return 'El celular no es valido. Usa formato +525512345678.';
    }
    if (raw.includes('password') && raw.includes('at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (raw.includes('unable to validate email address') || raw.includes('invalid email')) {
      return 'El correo electrónico no es válido.';
    }
    if (raw.includes('signup') && raw.includes('disabled')) {
      return 'El registro está deshabilitado en Supabase (Auth > Providers > Email).';
    }
    if (raw.includes('captcha')) {
      return 'El registro requiere captcha. Desactívalo o configura captcha en Supabase.';
    }
    return message || 'No se pudo completar el registro.';
  }

  private mapSupabaseLoginError(message?: string): string {
    const raw = (message || '').toLowerCase();
    if (raw.includes('invalid login credentials')) {
      return 'Correo o contraseña incorrectos, o el correo aún no está confirmado.';
    }
    if (raw.includes('email not confirmed')) {
      return 'Tu correo no está confirmado. Revisa tu bandeja de entrada.';
    }
    if (raw.includes('too many requests')) {
      return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
    }
    return message || 'No se pudo iniciar sesión.';
  }

  private mapSupabaseOtpError(message?: string): string {
    const raw = (message || '').toLowerCase();
    if (raw.includes('signups not allowed for otp')) {
      return 'Supabase bloquea OTP porque los registros estan deshabilitados. Activa temporalmente Signups o habilita Phone Auth correctamente.';
    }
    if (raw.includes('otp') && raw.includes('expired')) {
      return 'El codigo expiró. Solicita uno nuevo.';
    }
    if (raw.includes('invalid') && (raw.includes('otp') || raw.includes('token'))) {
      return 'El codigo no es valido. Verifica e intenta de nuevo.';
    }
    if ((raw.includes('email') || raw.includes('sms') || raw.includes('phone')) && raw.includes('rate limit')) {
      return 'Ya solicitaste varios codigos. Espera unos minutos para volver a intentar.';
    }
    if (raw.includes('signup') && raw.includes('disabled')) {
      return 'No se puede enviar codigo porque el acceso de autenticacion está deshabilitado en Supabase.';
    }
    if (raw.includes('phone') && raw.includes('not found')) {
      return 'No encontramos una cuenta con ese celular.';
    }
    if (raw.includes('invalid') && raw.includes('phone')) {
      return 'El celular no es valido. Usa formato +525512345678.';
    }
    return message || 'No se pudo validar el codigo.';
  }

  private mapSupabasePasswordUpdateError(message?: string): string {
    const raw = (message || '').toLowerCase();
    if (raw.includes('password') && raw.includes('at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (raw.includes('same') && raw.includes('password')) {
      return 'La nueva contraseña debe ser distinta a la anterior.';
    }
    return message || 'No se pudo actualizar la contraseña.';
  }

  private isUiError(value: unknown): value is { error: { message: string } } {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { error?: { message?: unknown } };
    return typeof candidate.error?.message === 'string';
  }

  private stringFromMeta(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private numberFromMeta(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private roleFromMeta(value: unknown): User['rol'] {
    if (
      value === 'admin' ||
      value === 'super_admin' ||
      value === 'empleado' ||
      value === 'cliente'
    ) {
      return value;
    }
    return 'cliente';
  }

  private syncPhoneFromMetadata(supabaseUser: SupabaseUser): void {
    const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
    const metadataPhone = typeof metadata['telefono'] === 'string' ? metadata['telefono'] : '';
    const normalizedPhone = this.normalizePhone(metadataPhone);
    if (!normalizedPhone) return;

    const userPhoneDigits = (supabaseUser.phone ?? '').replace(/\D/g, '');
    const normalizedDigits = normalizedPhone.replace(/\D/g, '');
    if (userPhoneDigits === normalizedDigits) return;

    void this.supabaseAuth.updatePhone(normalizedPhone).then(({ error }) => {
      if (error) {
        console.warn(`No se pudo sincronizar telefono auth: ${error.message}`);
      }
    });
  }

  private normalizePhone(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('+')) {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 11 || digits.length > 15) return null;
      return `+${digits}`;
    }

    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `+52${digitsOnly}`;
    }
    if (digitsOnly.length === 12 && digitsOnly.startsWith('52')) {
      return `+${digitsOnly}`;
    }

    return null;
  }
}
