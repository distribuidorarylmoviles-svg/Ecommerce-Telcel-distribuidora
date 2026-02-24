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

      this.orderService.crearSesionStripe(datosPedido).subscribe({
        next: async (res: any) => {
          // Nueva forma compatible con Stripe.js actual
          window.location.href = res.url;
        },
        error: (err) => {
          console.error("Error al crear sesión de pago:", err);
          alert('Error: No se pudo conectar con el servidor de pagos. Revisa la Edge Function.');
          this.loading = false;
        }
      });

    } catch (error) {
      console.error("Error con Stripe:", error);
      this.loading = false;
    }
  }

  private procesarPedidoWhatsApp(): void {
    this.loading = true;
    this.orderService.procesarPedido({
      items: this.cartService.cartItems(),
      ...this.form,
      subtotal: this.cartService.subtotal(),
      envio: this.cartService.shipping(),
      total: this.cartService.total()
    }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.orderSuccess = true;
          this.orderId = res.id_pedido ?? null;
          this.whatsappUrl = res.whatsapp_url ?? null;
          this.cartService.clear();
        }
      },
      error: () => this.loading = false
    });
  }
}