import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ServiceRequestService } from '../../../core/services/service-request';

type PortabilidadTab = 'personal' | 'portabilidad' | 'adicional';

@Component({
  selector: 'app-portabilidad',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './portabilidad.html',
  styleUrl: './portabilidad.scss',
})
export class Portabilidad {
  private serviceRequest = inject(ServiceRequestService);

  currentTab = signal<PortabilidadTab>('personal');
  sent = signal(false);
  loading = signal(false);
  error = signal('');
  responseMessage = signal('');
  emailSent = signal(true);

  form = {
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    curp: '',
    numeroCelular: '',
    nipSms: '',
    numeroContacto: '',
    otrosCampos: '',
  };

  goToTab(tab: PortabilidadTab): void {
    this.currentTab.set(tab);
  }

  onSubmit(formRef: NgForm): void {
    if (formRef.invalid) return;

    this.loading.set(true);
    this.error.set('');
    this.responseMessage.set('');

    this.serviceRequest.submitRequest({
      serviceType: 'portabilidad',
      nombre: `${this.form.nombre} ${this.form.apellidoPaterno} ${this.form.apellidoMaterno}`.replace(/\s+/g, ' ').trim(),
      telefonoCelular: this.form.numeroContacto,
      comentario: this.form.otrosCampos,
      payload: {
        nombre: this.form.nombre,
        apellidoPaterno: this.form.apellidoPaterno,
        apellidoMaterno: this.form.apellidoMaterno,
        curp: this.form.curp,
        numeroCelular: this.form.numeroCelular,
        nipSms: this.form.nipSms,
        numeroContacto: this.form.numeroContacto,
        otrosCampos: this.form.otrosCampos,
      },
    }).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.sent.set(true);
        this.emailSent.set(response.emailSent);
        this.responseMessage.set(response.message);
        formRef.resetForm();
        this.currentTab.set('personal');
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'No se pudo enviar la solicitud.');
      },
    });
  }
}
