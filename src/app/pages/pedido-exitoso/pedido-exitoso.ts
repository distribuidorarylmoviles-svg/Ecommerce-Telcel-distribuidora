import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { CartService } from '../../core/services/cart';

@Component({
  selector: 'app-pedido-exitoso',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './pedido-exitoso.html',
  styleUrls: ['./pedido-exitoso.scss']
})
export class PedidoExitoso implements OnInit {
  sessionId: string | null = null;
  guardando = false;
  ordenGuardada = false;

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private cartService: CartService,
  ) {}

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (this.sessionId) {
      void this.guardarOrdenStripe(this.sessionId);
    }
  }

  private async guardarOrdenStripe(sessionId: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const yaGuardada = localStorage.getItem(`orden_stripe_${sessionId}`);
    if (yaGuardada) {
      this.ordenGuardada = true;
      return;
    }

    this.guardando = true;
    try {
      const supabase = this.supabaseService.getClient();

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;

      const cartKey = `telcel_cart_user_${user?.id}`;
      const carritoRaw = localStorage.getItem(cartKey);
      const carrito: Array<{ id_producto?: string; precio: number; cantidad: number }> =
        carritoRaw ? JSON.parse(carritoRaw) : [];

      const total = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id ?? null,
          total_amount: total,
          status: 'paid',
          payment_method: 'stripe',
          proof_url: sessionId,
        })
        .select('id')
        .single();

      if (orderError || !orderRow?.id) {
        console.error('Error guardando orden Stripe:', orderError?.message);
        return;
      }

      if (carrito.length > 0) {
        const orderItems = carrito.map((item) => ({
          order_id: orderRow.id,
          product_id: item.id_producto ?? null,
          quantity: item.cantidad,
          price_at_purchase: item.precio,
        }));
        await supabase.from('order_items').insert(orderItems);

        // Actualizar stock
        for (const item of carrito) {
          if (item.id_producto) {
            const { data: producto } = await supabase
              .from('products')
              .select('stock')
              .eq('id', item.id_producto)
              .single();

            if (producto) {
              const nuevoStock = Math.max(0, (producto.stock ?? 0) - item.cantidad);
              await supabase
                .from('products')
                .update({ stock: nuevoStock })
                .eq('id', item.id_producto);
            }
          }
        }
      }

      localStorage.setItem(`orden_stripe_${sessionId}`, 'true');
      this.cartService.clear(); // ✅ limpia memoria y localStorage

      this.ordenGuardada = true;
    } catch (err) {
      console.error('Error inesperado:', err);
    } finally {
      this.guardando = false;
    }
  }
}