import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ServiceRequestService } from '../../../core/services/service-request';

@Component({
  selector: 'app-recuperacion',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './recuperacion.html',
  styleUrl: './recuperacion.scss',
})
export class Recuperacion {
  private serviceRequest = inject(ServiceRequestService);

  sent = signal(false);
  loading = signal(false);
  error = signal('');
  responseMessage = signal('');
  emailSent = signal(true);

  form = {
    nombre: '',
    correoElectronico: '',
    telefonoCelular: '',
    comentario: '',
  };

  onSubmit(formRef: NgForm): void {
    if (formRef.invalid) return;

    this.loading.set(true);
    this.error.set('');
    this.responseMessage.set('');

    this.serviceRequest.submitRequest({
      serviceType: 'recuperacion',
      nombre: this.form.nombre,
      correoElectronico: this.form.correoElectronico,
      telefonoCelular: this.form.telefonoCelular,
      comentario: this.form.comentario,
    }).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.sent.set(true);
        this.emailSent.set(response.emailSent);
        this.responseMessage.set(response.message);
        formRef.resetForm();
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'No se pudo enviar la solicitud.');
      },
    });
  }
}
