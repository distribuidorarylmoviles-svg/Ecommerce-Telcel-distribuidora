import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../core/services/cart';
import { OrderService } from '../../core/services/order';
import { AuthService } from '../../core/services/auth';
import { CheckoutRequest } from '../../core/models/order';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment'; 

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, RouterLink],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.scss'],
})
export class Checkout implements OnInit {
  cartService = inject(CartService);
  private orderService = inject(OrderService);
  private auth = inject(AuthService);
  private router = inject(Router);

  form: CheckoutRequest = {
    nombre: '', apellidos: '', email: '', telefono: '',
    calle: '', colonia: '', codigo_postal: '', ciudad: '',
    estado: '', referencias: ''
  };

  loading = false;
  orderSuccess = false;
  orderId: string | null = null;
  whatsappUrl: string | null = null;
  errorMsg: string | null = null;
  metodoPago: 'stripe' | 'transferencia' = 'stripe';

  ngOnInit(): void {
    if (this.cartService.cartItems().length === 0) {
      this.router.navigate(['/carrito']);
      return;
    }
    const user = this.auth.user();
    if (user) {
      this.form.nombre = user.nombre;
      this.form.apellidos = `${user.apellido_paterno} ${user.apellido_materno}`;
      this.form.email = user.correo;
    }
  }

  onSubmit(): void {
    if (this.metodoPago === 'stripe') {
      this.pagarConStripe();
    } else {
      this.procesarPedidoWhatsApp();
    }
  }

  async pagarConStripe() {
    this.loading = true;
    try {
      const stripe: any = await loadStripe(environment.stripePublicKey);
      if (!stripe) throw new Error('No se pudo cargar Stripe');

      const datosPedido = {
        items: this.cartService.cartItems(),
        email: this.form.email,
        total: this.cartService.total(),
        customer_info: this.form
      };

      const token = await this.orderService.getSession();
      if (!token) {
        alert('Debes iniciar sesión para pagar.');
        this.loading = false;
        return;
      }

      this.orderService.crearSesionStripe(datosPedido, token).subscribe({
        next: async (res: any) => {
          window.location.href = res.url;
        },
        error: (err: any) => {
          console.error("Error al crear sesión de pago:", err);
          alert('Error: No se pudo conectar con el servidor de pagos.');
          this.loading = false;
        }
      });

    } catch (error) {
      console.error("Error con Stripe:", error);
      this.loading = false;
    }
  }

  private procesarPedidoWhatsApp(): void {
    const items = this.cartService.cartItems();
    const total = this.cartService.total();

    const lineas = items.map((i: any) => `• ${i.nombre} x${i.cantidad} - $${(i.precio * i.cantidad).toFixed(2)} MXN`).join('\n');
    const msg = `Hola, quiero realizar un pedido:\n\n${lineas}\n\nTotal: $${total.toFixed(2)} MXN\n\nNombre: ${this.form.nombre} ${this.form.apellidos}\nTeléfono: ${this.form.telefono}\nDirección: ${this.form.calle}, ${this.form.colonia}, ${this.form.ciudad}, ${this.form.estado} CP ${this.form.codigo_postal}`;

    const url = `https://wa.me/527561651941?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    this.orderSuccess = true;
    this.cartService.clear();
  }
}