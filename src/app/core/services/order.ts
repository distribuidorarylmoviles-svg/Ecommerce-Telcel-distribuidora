import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { OrderResponse } from '../models/order';
import { CartItem } from '../models/cart-item';
import { SupabaseService } from './supabase.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(
    private supabaseService: SupabaseService,
    private http: HttpClient
  ) {}

  async getSession(): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  crearSesionStripe(data: any, token: string): Observable<{ sessionId: string }> {
    const url = `${environment.supabaseUrl}/functions/v1/hyper-action`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    return this.http.post<{ sessionId: string }>(url, data, { headers });
  }

  procesarPedido(data: {
    items: CartItem[];
    nombre: string;
    apellidos: string;
    email: string;
    telefono: string;
    calle: string;
    colonia: string;
    codigo_postal: string;
    ciudad: string;
    estado: string;
    referencias: string;
    subtotal: number;
    envio: number;
    total: number;
  }): Observable<OrderResponse> {
    return from(this.procesarPedidoSupabase(data));
  }

  private async procesarPedidoSupabase(data: any): Promise<OrderResponse> {
    const supabase = this.supabaseService.getClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      throw new Error('Debes iniciar sesión para procesar el pedido.');
    }

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        total_amount: data.total,
        status: 'pending',
        payment_method: 'transferencia',
        proof_url: null,
      })
      .select('id')
      .single();

    if (orderError || !orderRow?.id) {
      throw { error: { message: orderError?.message || 'No se pudo guardar el pedido.' } };
    }

    const orderItems = data.items.map((item: CartItem) => ({
      order_id: orderRow.id,
      product_id: item.id_producto ? String(item.id_producto) : null, // ✅ corregido
      quantity: item.cantidad,
      price_at_purchase: item.precio,
    }));

    if (orderItems.length > 0) {
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) {
        throw { error: { message: itemsError.message || 'Error en productos.' } };
      }

      // Actualizar stock
      for (const item of data.items as CartItem[]) {
        if (item.id_producto) {
          const { data: producto } = await supabase
            .from('products')
            .select('stock')
            .eq('id', String(item.id_producto))
            .single();

          if (producto) {
            const nuevoStock = Math.max(0, (producto.stock ?? 0) - item.cantidad);
            await supabase
              .from('products')
              .update({ stock: nuevoStock })
              .eq('id', String(item.id_producto));
          }
        }
      }
    }

    const whatsappMsg = `Hola, realicé el pedido ${orderRow.id}. Total: $${data.total.toFixed(2)} MXN.`;
    const whatsappUrl = `https://wa.me/527561651941?text=${encodeURIComponent(whatsappMsg)}`;

    return {
      success: true,
      message: 'Pedido registrado correctamente.',
      id_pedido: orderRow.id,
      whatsapp_url: whatsappUrl,
    };
  }
}