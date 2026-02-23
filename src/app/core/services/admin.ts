import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  AdminCategory,
  AdminOrder,
  AdminOrderItem,
  AdminProduct,
  AdminProductInput,
  AdminServiceRequest,
} from '../models/admin';

type DbProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  category: string | null;
  image_url: string | null;
  stock: number | null;
  created_at: string | null;
};

type DbOrderRow = {
  id: string;
  user_id: string | null;
  total_amount: number | string;
  status: string | null;
  payment_method: string | null;
  proof_url: string | null;
  created_at: string | null;
};

type DbOrderItemRow = {
  id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number | null;
  price_at_purchase: number | string | null;
};

type DbServiceRequestRow = {
  id: string;
  service_type: string;
  nombre: string;
  correo_electronico: string | null;
  telefono_celular: string | null;
  comentario: string | null;
  payload: Record<string, unknown> | null;
  destination_email: string;
  email_sent: boolean;
  email_error: string | null;
  user_id: string | null;
  created_at: string | null;
};

type DbProductNameRow = {
  id: string;
  name: string | null;
};

type DbCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string | null;
};

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private supabaseService: SupabaseService) {}

  async getProducts(): Promise<AdminProduct[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, category, image_url, stock, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'No se pudieron cargar los productos.');
    }

    return (data ?? []).map((row) => this.mapProduct(row as DbProductRow));
  }

  async getCategories(): Promise<AdminCategory[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, description, image_url, created_at')
      .order('name', { ascending: true });

    if (error) {
      const errorCode = (error as { code?: string }).code;
      const errorMessage = (error.message ?? '').toLowerCase();
      const missingTable =
        errorCode === '42P01' || errorCode === 'PGRST205' || errorMessage.includes('could not find the table');
      if (missingTable) {
        throw new Error(
          'Falta la tabla categories. Ejecuta el SQL de admin para habilitar gestión de categorías.',
        );
      }
      throw new Error(error.message || 'No se pudieron cargar las categorías.');
    }

    return (data ?? []).map((row) => this.mapCategory(row as DbCategoryRow));
  }

  async createCategory(input: AdminCategoryInput): Promise<AdminCategory> {
    const name = input.name.trim();
    if (!name) {
      throw new Error('El nombre de la categoría es obligatorio.');
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('categories')
      .insert({ 
        name,
        description: input.description.trim() || null,
        image_url: input.imageUrl.trim() || null
      })
      .select('id, name, description, image_url, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'No se pudo crear la categoría.');
    }

    return this.mapCategory(data as DbCategoryRow);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: categoryRow, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, created_at')
      .eq('id', categoryId)
      .maybeSingle();

    if (categoryError) {
      throw new Error(categoryError.message || 'No se pudo cargar la categoría.');
    }
    if (!categoryRow) {
      throw new Error('La categoría ya no existe.');
    }

    const category = this.mapCategory(categoryRow as DbCategoryRow);
    const categoryName = category.name.trim();

    if (categoryName) {
      const { error: clearError } = await supabase
        .from('products')
        .update({ category: null })
        .eq('category', categoryName);

      if (clearError) {
        throw new Error(clearError.message || 'No se pudieron desvincular los productos de la categoría.');
      }
    }

    const { error: deleteError } = await supabase.from('categories').delete().eq('id', categoryId);
    if (deleteError) {
      throw new Error(deleteError.message || 'No se pudo eliminar la categoría.');
    }
  }

  async deleteAllCategories(): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // 1. Desvincular todos los productos de sus categorías
    const { error: clearError } = await supabase
      .from('products')
      .update({ category: null })
      .neq('category', ''); // O simplemente no filtrar para limpiar todos

    if (clearError) {
      throw new Error(clearError.message || 'No se pudieron desvincular los productos.');
    }

    // 2. Eliminar todas las categorías
    // Usamos un filtro que siempre sea verdadero (como id no es nulo) para permitir el delete masivo si no hay políticas que lo impidan
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .neq('name', ''); 

    if (deleteError) {
      throw new Error(deleteError.message || 'No se pudieron eliminar las categorías.');
    }
  }

  async saveProduct(input: AdminProductInput, id?: string): Promise<AdminProduct> {
    if (id) {
      return this.updateProduct(id, input);
    }
    return this.insertProduct(input);
  }

  async deleteProduct(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      throw new Error(error.message || 'No se pudo eliminar el producto.');
    }
  }

  async getOrders(): Promise<AdminOrder[]> {
    const supabase = this.supabaseService.getClient();
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, status, payment_method, proof_url, created_at')
      .order('created_at', { ascending: false });

    if (ordersError) {
      throw new Error(ordersError.message || 'No se pudieron cargar las compras.');
    }

    const orders = (ordersData ?? []) as DbOrderRow[];
    const orderIds = orders.map((order) => order.id).filter((id) => typeof id === 'string' && !!id);
    if (orderIds.length === 0) {
      return [];
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity, price_at_purchase')
      .in('order_id', orderIds);

    if (itemsError) {
      throw new Error(itemsError.message || 'No se pudieron cargar los productos de las compras.');
    }

    const orderItems = (itemsData ?? []) as DbOrderItemRow[];
    const productIds = Array.from(
      new Set(
        orderItems
          .map((item) => item.product_id)
          .filter((id): id is string => typeof id === 'string' && !!id),
      ),
    );

    const productNameById = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);

      if (productsError) {
        throw new Error(productsError.message || 'No se pudieron cargar los nombres de productos.');
      }

      for (const product of (productsData ?? []) as DbProductNameRow[]) {
        productNameById.set(product.id, product.name?.trim() || 'Producto');
      }
    }

    const itemsByOrder = new Map<string, AdminOrderItem[]>();
    for (const item of orderItems) {
      const orderId = item.order_id ?? '';
      if (!orderId) continue;

      const mappedItem: AdminOrderItem = {
        id: item.id,
        orderId,
        productId: item.product_id,
        productName: item.product_id
          ? productNameById.get(item.product_id) ?? 'Producto eliminado'
          : 'Producto no asociado',
        quantity: Math.max(1, this.toNumber(item.quantity, 1)),
        priceAtPurchase: this.toNumber(item.price_at_purchase, 0),
      };

      const current = itemsByOrder.get(orderId) ?? [];
      current.push(mappedItem);
      itemsByOrder.set(orderId, current);
    }

    return orders.map((order) => ({
      id: order.id,
      userId: order.user_id,
      totalAmount: this.toNumber(order.total_amount, 0),
      status: order.status?.trim() || 'pending',
      paymentMethod: order.payment_method?.trim() || 'N/A',
      proofUrl: order.proof_url,
      createdAt: order.created_at,
      items: itemsByOrder.get(order.id) ?? [],
    }));
  }

  async getServiceRequests(): Promise<AdminServiceRequest[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('service_requests')
      .select(
        'id, service_type, nombre, correo_electronico, telefono_celular, comentario, payload, destination_email, email_sent, email_error, user_id, created_at',
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'No se pudieron cargar las solicitudes de servicio.');
    }

    return (data ?? []).map((row) => this.mapServiceRequest(row as DbServiceRequestRow));
  }

  async deleteServiceRequest(requestId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('service_requests').delete().eq('id', requestId);

    if (error) {
      throw new Error(error.message || 'No se pudo eliminar la solicitud.');
    }
  }

  async resendServiceRequestEmail(requestId: string, to?: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const destination = to?.trim();

    const { data, error } = await supabase.functions.invoke('send-service-request-email', {
      body: {
        request_id: requestId,
        ...(destination ? { to: destination } : {}),
      },
    });

    if (error) {
      const functionError = await this.extractFunctionError(error);
      throw new Error(functionError || error.message || 'No se pudo reenviar el correo.');
    }

    const response = data as { ok?: boolean; error?: string } | null | undefined;
    if (response?.ok === false) {
      throw new Error(response.error?.trim() || 'No se pudo reenviar el correo.');
    }
  }

  private async insertProduct(input: AdminProductInput): Promise<AdminProduct> {
    const supabase = this.supabaseService.getClient();
    const payload = this.toProductPayload(input);

    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select('id, name, description, price, category, image_url, stock, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'No se pudo crear the product.');
    }

    return this.mapProduct(data as DbProductRow);
  }

  private async updateProduct(id: string, input: AdminProductInput): Promise<AdminProduct> {
    const supabase = this.supabaseService.getClient();
    const payload = this.toProductPayload(input);

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select('id, name, description, price, category, image_url, stock, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'No se pudo actualizar el producto.');
    }

    return this.mapProduct(data as DbProductRow);
  }

  private toProductPayload(input: AdminProductInput): Record<string, string | number | null> {
    const name = input.name.trim();
    const description = input.description.trim();
    const category = input.category.trim();
    const imageUrl = input.imageUrl.trim();

    if (!name) {
      throw new Error('El nombre del producto es obligatorio.');
    }

    return {
      name,
      description: description || null,
      price: this.toNumber(input.price, 0),
      category: category || null,
      image_url: imageUrl || null,
      stock: Math.max(0, Math.floor(this.toNumber(input.stock, 0))),
    };
  }

  private mapProduct(row: DbProductRow): AdminProduct {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      price: this.toNumber(row.price, 0),
      category: row.category ?? '',
      stock: this.toNumber(row.stock, 0),
      imageUrl: row.image_url ?? '',
      createdAt: row.created_at,
    };
  }

  private mapCategory(row: DbCategoryRow): AdminCategory {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      imageUrl: row.image_url ?? '',
      createdAt: row.created_at,
    };
  }

  private mapServiceRequest(row: DbServiceRequestRow): AdminServiceRequest {
    return {
      id: row.id,
      serviceType: row.service_type,
      nombre: row.nombre,
      correoElectronico: row.correo_electronico,
      telefonoCelular: row.telefono_celular,
      comentario: row.comentario,
      payload: row.payload ?? {},
      destinationEmail: row.destination_email,
      emailSent: row.email_sent,
      emailError: row.email_error,
      userId: row.user_id,
      createdAt: row.created_at,
    };
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
        // Ignorar error de parseo.
      }
    }

    if (maybeError?.context?.text) {
      try {
        const body = await maybeError.context.text();
        if (body.trim()) return body;
      } catch {
        // Ignorar error de lectura.
      }
    }

    if (typeof maybeError?.message === 'string' && maybeError.message.trim()) {
      return maybeError.message;
    }

    return null;
  }

  private toNumber(value: number | string | null | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }
}
