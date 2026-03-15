import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  AdminCategory,
  AdminCategoryInput,
  AdminOrder,
  AdminOrderItem,
  AdminProduct,
  AdminProductInput,
  AdminServiceRequest,
  TrackingResult,
} from '../models/admin';

export type StoreInfo = {
  id: number;
  telefono: string;
  correo: string;
  whatsapp: string;
  horario_dias: string;
  horario_horas: string;
  direccion: string;
  maps_embed_url: string;
  maps_link: string;
};

type DbProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  category: string | null;
  image_url: string | null;
  video_url: string | null; // ✅
  stock: number | null;
  created_at: string | null;
  deleted_at: string | null;
};

type DbOrderRow = {
  id: string;
  user_id: string | null;
  total_amount: number | string;
  status: string | null;
  payment_method: string | null;
  proof_url: string | null;
  created_at: string | null;
  deleted_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
  tracking_url: string | null;
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
  deleted_at: string | null;
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
  deleted_at: string | null;
};

type SkydropxRadarEvent = {
  status: string | null;
  date: string | null;
  description: string | null;
  location: string | null;
};

type SkydropxRadarRecord = {
  id?: string;
  tracking_number?: string;
  status?: string;
  events?: SkydropxRadarEvent[];
};

type SkydropxRadarResponse = SkydropxRadarRecord | SkydropxRadarRecord[];

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private supabaseService: SupabaseService) {}

  // ─── Productos activos ───────────────────────────────────────────────────

  async getProducts(): Promise<AdminProduct[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, category, image_url, video_url, stock, created_at, deleted_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message || 'No se pudieron cargar los productos.');
    return (data ?? []).map((row) => this.mapProduct(row as DbProductRow));
  }

  async saveProduct(input: AdminProductInput, id?: string): Promise<AdminProduct> {
    if (id) return this.updateProduct(id, input);
    return this.insertProduct(input);
  }

  async deleteProduct(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('products').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id');
    if (error) throw new Error(error.message || 'No se pudo mover el producto a la papelera.');
    if (!data || data.length === 0) throw new Error('No se actualizó el producto. Verifica las políticas RLS (UPDATE) en Supabase.');
  }

  // ─── Upload de video ─────────────────────────────────────────────────────

  async uploadProductVideo(file: File, productId: string): Promise<string> {
    const supabase = this.supabaseService.getClient();
    const ext = file.name.split('.').pop();
    const path = `${productId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('product-videos')
      .upload(path, file, { upsert: true });

    if (error) throw new Error(error.message || 'No se pudo subir el video.');

    const { data } = supabase.storage.from('product-videos').getPublicUrl(path);
    return data.publicUrl;
  }

  async deleteProductVideo(videoUrl: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const path = videoUrl.split('/product-videos/')[1];
    if (!path) return;
    await supabase.storage.from('product-videos').remove([path]);
  }

  // ─── Categorías activas ──────────────────────────────────────────────────

  async getCategories(): Promise<AdminCategory[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, description, image_url, created_at, deleted_at')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      const errorCode = (error as { code?: string }).code;
      const errorMessage = (error.message ?? '').toLowerCase();
      const missingTable = errorCode === '42P01' || errorCode === 'PGRST205' || errorMessage.includes('could not find the table');
      if (missingTable) throw new Error('Falta la tabla categories. Ejecuta el SQL de admin para habilitar gestión de categorías.');
      throw new Error(error.message || 'No se pudieron cargar las categorías.');
    }
    return (data ?? []).map((row) => this.mapCategory(row as DbCategoryRow));
  }

  async createCategory(input: AdminCategoryInput): Promise<AdminCategory> {
    const name = input.name.trim();
    if (!name) throw new Error('El nombre de la categoría es obligatorio.');
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, description: input.description.trim() || null, image_url: input.imageUrl.trim() || null })
      .select('id, name, description, image_url, created_at, deleted_at').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo crear la categoría.');
    return this.mapCategory(data as DbCategoryRow);
  }

  async updateCategory(id: string, input: AdminCategoryInput): Promise<AdminCategory> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('categories')
      .update({ name: input.name.trim(), description: input.description.trim() || null, image_url: input.imageUrl.trim() || null })
      .eq('id', id)
      .select('id, name, description, image_url, created_at, deleted_at').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo actualizar la categoría.');
    return this.mapCategory(data as DbCategoryRow);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('categories').update({ deleted_at: new Date().toISOString() }).eq('id', categoryId).select('id');
    if (error) throw new Error(error.message || 'No se pudo mover la categoría a la papelera.');
    if (!data || data.length === 0) throw new Error('No se actualizó la categoría. Verifica las políticas RLS (UPDATE) en Supabase.');
  }

  async deleteAllCategories(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('categories').update({ deleted_at: new Date().toISOString() }).is('deleted_at', null);
    if (error) throw new Error(error.message || 'No se pudieron mover las categorías a la papelera.');
  }

  // ─── Solicitudes activas ─────────────────────────────────────────────────

  async getServiceRequests(): Promise<AdminServiceRequest[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('service_requests')
      .select('id, service_type, nombre, correo_electronico, telefono_celular, comentario, payload, destination_email, email_sent, email_error, user_id, created_at, deleted_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message || 'No se pudieron cargar las solicitudes de servicio.');
    return (data ?? []).map((row) => this.mapServiceRequest(row as DbServiceRequestRow));
  }

  async deleteServiceRequest(requestId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('service_requests').update({ deleted_at: new Date().toISOString() }).eq('id', requestId).select('id');
    if (error) throw new Error(error.message || 'No se pudo mover la solicitud a la papelera.');
    if (!data || data.length === 0) throw new Error('No se actualizó la solicitud. Verifica las políticas RLS (UPDATE) en Supabase.');
  }

  async resendServiceRequestEmail(requestId: string, to?: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const destination = to?.trim();
    const { data, error } = await supabase.functions.invoke('send-service-request-email', {
      body: { request_id: requestId, ...(destination ? { to: destination } : {}) },
    });
    if (error) {
      const functionError = await this.extractFunctionError(error);
      throw new Error(functionError || error.message || 'No se pudo reenviar el correo.');
    }
    const response = data as { ok?: boolean; error?: string } | null | undefined;
    if (response?.ok === false) throw new Error(response.error?.trim() || 'No se pudo reenviar el correo.');
  }

  // ─── Compras activas ─────────────────────────────────────────────────────

  async getOrders(): Promise<AdminOrder[]> {
    const supabase = this.supabaseService.getClient();
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, total_amount, status, payment_method, proof_url, created_at, deleted_at, tracking_number, carrier, tracking_url')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (ordersError) throw new Error(ordersError.message || 'No se pudieron cargar las compras.');

    const orders = (ordersData ?? []) as DbOrderRow[];
    const orderIds = orders.map((o) => o.id).filter((id) => typeof id === 'string' && !!id);
    if (orderIds.length === 0) return [];

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items').select('id, order_id, product_id, quantity, price_at_purchase').in('order_id', orderIds);
    if (itemsError) throw new Error(itemsError.message || 'No se pudieron cargar los productos de las compras.');

    const orderItems = (itemsData ?? []) as DbOrderItemRow[];
    const productIds = Array.from(new Set(orderItems.map((i) => i.product_id).filter((id): id is string => typeof id === 'string' && !!id)));

    const productNameById = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase.from('products').select('id, name').in('id', productIds);
      if (productsError) throw new Error(productsError.message || 'No se pudieron cargar los nombres de productos.');
      for (const product of (productsData ?? []) as DbProductNameRow[]) {
        productNameById.set(product.id, product.name?.trim() || 'Producto');
      }
    }

    const itemsByOrder = new Map<string, AdminOrderItem[]>();
    for (const item of orderItems) {
      const orderId = item.order_id ?? '';
      if (!orderId) continue;
      const mappedItem: AdminOrderItem = {
        id: item.id, orderId,
        productId: item.product_id,
        productName: item.product_id ? productNameById.get(item.product_id) ?? 'Producto eliminado' : 'Producto no asociado',
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
      deletedAt: order.deleted_at ?? null,
      items: itemsByOrder.get(order.id) ?? [],
      trackingNumber: order.tracking_number ?? null,
      carrier: order.carrier ?? null,
      trackingUrl: order.tracking_url ?? null,
    }));
  }

  async saveTrackingNumber(orderId: string, trackingNumber: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('orders')
      .update({ tracking_number: trackingNumber.trim() || null })
      .eq('id', orderId);
    if (error) throw new Error(error.message || 'No se pudo guardar el número de guía.');
  }

  async deleteOrder(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message || 'No se pudo mover la compra a la papelera.');
  }

  // ─── Información de la tienda ────────────────────────────────────────────

  async getStoreInfo(): Promise<StoreInfo | null> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.from('store_info').select('*').single();
    if (error) return null;
    return data as StoreInfo;
  }

  async updateStoreInfo(info: StoreInfo): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('store_info').update(info).eq('id', info.id);
    if (error) throw new Error(error.message || 'No se pudo actualizar la información de la tienda.');
  }

  // ─── Papelera: obtener eliminados ────────────────────────────────────────

  async getDeletedProducts(): Promise<AdminProduct[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('products').select('id, name, description, price, category, image_url, video_url, stock, created_at, deleted_at')
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    if (error) throw new Error(error.message || 'No se pudieron cargar los productos eliminados.');
    return (data ?? []).map((row) => this.mapProduct(row as DbProductRow));
  }

  async getDeletedCategories(): Promise<AdminCategory[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('categories').select('id, name, description, image_url, created_at, deleted_at')
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    if (error) throw new Error(error.message || 'No se pudieron cargar las categorías eliminadas.');
    return (data ?? []).map((row) => this.mapCategory(row as DbCategoryRow));
  }

  async getDeletedServiceRequests(): Promise<AdminServiceRequest[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('service_requests')
      .select('id, service_type, nombre, correo_electronico, telefono_celular, comentario, payload, destination_email, email_sent, email_error, user_id, created_at, deleted_at')
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    if (error) throw new Error(error.message || 'No se pudieron cargar las solicitudes eliminadas.');
    return (data ?? []).map((row) => this.mapServiceRequest(row as DbServiceRequestRow));
  }

  async getDeletedOrders(): Promise<AdminOrder[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('orders').select('id, user_id, total_amount, status, payment_method, proof_url, created_at, deleted_at, tracking_number, carrier, tracking_url')
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    if (error) throw new Error(error.message || 'No se pudieron cargar las compras eliminadas.');
    return (data ?? []).map((order) => ({
      id: order.id,
      userId: order.user_id,
      totalAmount: this.toNumber(order.total_amount, 0),
      status: order.status?.trim() || 'pending',
      paymentMethod: order.payment_method?.trim() || 'N/A',
      proofUrl: order.proof_url,
      createdAt: order.created_at,
      deletedAt: order.deleted_at ?? null,
      items: [],
      trackingNumber: order.tracking_number ?? null,
      carrier: order.carrier ?? null,
      trackingUrl: order.tracking_url ?? null,
    }));
  }

  // ─── Papelera: restaurar ─────────────────────────────────────────────────

  async restoreProduct(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('products').update({ deleted_at: null }).eq('id', id);
    if (error) throw new Error(error.message || 'No se pudo restaurar el producto.');
  }

  async restoreCategory(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('categories').update({ deleted_at: null }).eq('id', id);
    if (error) throw new Error(error.message || 'No se pudo restaurar la categoría.');
  }

  async restoreServiceRequest(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('service_requests').update({ deleted_at: null }).eq('id', id);
    if (error) throw new Error(error.message || 'No se pudo restaurar la solicitud.');
  }

  async restoreOrder(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('orders').update({ deleted_at: null }).eq('id', id);
    if (error) throw new Error(error.message || 'No se pudo restaurar la compra.');
  }

  // ─── Papelera: eliminar permanentemente ─────────────────────────────────

  async permanentlyDeleteProduct(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase.from('order_items').update({ product_id: null }).eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message || 'No se pudo eliminar permanentemente el producto.');
  }

  async permanentlyDeleteCategory(categoryId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: categoryRow } = await supabase.from('categories').select('id, name').eq('id', categoryId).maybeSingle();
    if (categoryRow) {
      const categoryName = (categoryRow as { name: string }).name?.trim();
      if (categoryName) await supabase.from('products').update({ category: null }).eq('category', categoryName);
    }
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) throw new Error(error.message || 'No se pudo eliminar permanentemente la categoría.');
  }

  async permanentlyDeleteServiceRequest(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('service_requests').delete().eq('id', id);
    if (error) throw new Error(error.message || 'No se pudo eliminar permanentemente la solicitud.');
  }

  async permanentlyDeleteOrder(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase.from('order_items').delete().eq('order_id', id);
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw new Error(error.message || 'No se pudo eliminar permanentemente la compra.');
  }

  async emptyTrash(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const [p, c, s, o] = await Promise.all([
      supabase.from('products').delete().not('deleted_at', 'is', null),
      supabase.from('categories').delete().not('deleted_at', 'is', null),
      supabase.from('service_requests').delete().not('deleted_at', 'is', null),
      supabase.from('orders').delete().not('deleted_at', 'is', null),
    ]);
    if (p.error) throw new Error(p.error.message || 'No se pudieron eliminar los productos.');
    if (c.error) throw new Error(c.error.message || 'No se pudieron eliminar las categorías.');
    if (s.error) throw new Error(s.error.message || 'No se pudieron eliminar las solicitudes.');
    if (o.error) throw new Error(o.error.message || 'No se pudieron eliminar las compras.');
  }

  // ─── Exportación de datos ────────────────────────────────────────────────

  getProductsExportData(products: AdminProduct[]): { headers: string[]; rows: (string | number)[][] } {
    return {
      headers: ['ID', 'Nombre', 'Descripción', 'Precio (MXN)', 'Categoría', 'Stock', 'Fecha creación'],
      rows: products.map((p) => [p.id, p.name, p.description || '', p.price, p.category || 'Sin categoría', p.stock, p.createdAt || '']),
    };
  }

  getCategoriesExportData(categories: AdminCategory[]): { headers: string[]; rows: (string | number)[][] } {
    return {
      headers: ['ID', 'Nombre', 'Descripción', 'Fecha creación'],
      rows: categories.map((c) => [c.id, c.name, c.description || '', c.createdAt || '']),
    };
  }

  getOrdersExportData(orders: AdminOrder[]): { headers: string[]; rows: (string | number)[][] } {
    return {
      headers: ['ID', 'Usuario', 'Total (MXN)', 'Estado', 'Método de pago', 'Fecha', 'Productos'],
      rows: orders.map((o) => [o.id, o.userId || 'N/A', o.totalAmount, o.status, o.paymentMethod, o.createdAt || '', o.items.map((i) => `${i.productName} x${i.quantity}`).join('; ')]),
    };
  }

  getServiceRequestsExportData(requests: AdminServiceRequest[]): { headers: string[]; rows: (string | number)[][] } {
    return {
      headers: ['ID', 'Servicio', 'Nombre', 'Correo', 'Teléfono', 'Estado correo', 'Fecha'],
      rows: requests.map((r) => [r.id, r.serviceType, r.nombre, r.correoElectronico || '', r.telefonoCelular || '', r.emailSent ? 'Enviado' : r.emailError ? 'Error' : 'Pendiente', r.createdAt || '']),
    };
  }

  // ─── Rastreo Skydropx ────────────────────────────────────────────────────

  async trackShipment(trackingNumber: string, carrier: string): Promise<TrackingResult> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.functions.invoke('track-shipment', {
      body: { tracking_number: trackingNumber, carrier },
    });
    if (error) {
      const functionError = await this.extractFunctionError(error);
      throw new Error(functionError || error.message || 'No se pudo rastrear el paquete.');
    }
    const res = data as { ok: boolean; data?: SkydropxRadarResponse; error?: string };
    if (!res.ok) throw new Error(res.error || 'No se pudo rastrear el paquete.');
    return this.mapTrackingResult(trackingNumber, carrier, res.data);
  }

  private mapTrackingResult(trackingNumber: string, carrier: string, apiData?: SkydropxRadarResponse): TrackingResult {
    const record = Array.isArray(apiData) ? apiData[0] : apiData;
    const events = (record?.events ?? []).map((e: SkydropxRadarEvent) => ({
      status: e.status ?? '',
      description: e.description ?? '',
      location: e.location ?? '',
      date: e.date ?? '',
    }));
    return {
      trackingNumber: record?.tracking_number ?? trackingNumber,
      carrier: carrier,
      status: record?.status ?? 'Sin información',
      events,
    };
  }

  // ─── Privados ────────────────────────────────────────────────────────────

  private async insertProduct(input: AdminProductInput): Promise<AdminProduct> {
    const supabase = this.supabaseService.getClient();
    const payload = this.toProductPayload(input);
    const { data, error } = await supabase.from('products').insert(payload)
      .select('id, name, description, price, category, image_url, video_url, stock, created_at, deleted_at').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo crear el producto.');
    return this.mapProduct(data as DbProductRow);
  }

  private async updateProduct(id: string, input: AdminProductInput): Promise<AdminProduct> {
    const supabase = this.supabaseService.getClient();
    const payload = this.toProductPayload(input);
    const { data, error } = await supabase.from('products').update(payload).eq('id', id)
      .select('id, name, description, price, category, image_url, video_url, stock, created_at, deleted_at').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo actualizar el producto.');
    return this.mapProduct(data as DbProductRow);
  }

  private toProductPayload(input: AdminProductInput): Record<string, string | number | null> {
    const name = input.name.trim();
    if (!name) throw new Error('El nombre del producto es obligatorio.');
    return {
      name,
      description: input.description.trim() || null,
      price: this.toNumber(input.price, 0),
      category: input.category.trim() || null,
      image_url: input.imageUrl.trim() || null,
      video_url: input.videoUrl ?? null, // ✅
      stock: Math.max(0, Math.floor(this.toNumber(input.stock, 0))),
    };
  }

  private mapProduct(row: DbProductRow): AdminProduct {
    return {
      id: row.id, name: row.name, description: row.description ?? '',
      price: this.toNumber(row.price, 0), category: row.category ?? '',
      stock: this.toNumber(row.stock, 0), imageUrl: row.image_url ?? '',
      videoUrl: row.video_url ?? null, // ✅
      createdAt: row.created_at, deletedAt: row.deleted_at ?? null,
    };
  }

  private mapCategory(row: DbCategoryRow): AdminCategory {
    return {
      id: row.id, name: row.name, description: row.description ?? '',
      imageUrl: row.image_url ?? '', createdAt: row.created_at, deletedAt: row.deleted_at ?? null,
    };
  }

  private mapServiceRequest(row: DbServiceRequestRow): AdminServiceRequest {
    return {
      id: row.id, serviceType: row.service_type, nombre: row.nombre,
      correoElectronico: row.correo_electronico, telefonoCelular: row.telefono_celular,
      comentario: row.comentario, payload: row.payload ?? {},
      destinationEmail: row.destination_email, emailSent: row.email_sent,
      emailError: row.email_error, userId: row.user_id,
      createdAt: row.created_at, deletedAt: row.deleted_at ?? null,
    };
  }

  private async extractFunctionError(error: unknown): Promise<string | null> {
    const maybeError = error as {
      message?: string;
      context?: { json?: () => Promise<unknown>; text?: () => Promise<string> };
    };
    if (maybeError?.context?.json) {
      try {
        const body = await maybeError.context.json();
        if (body && typeof body === 'object') {
          const message = (body as { error?: unknown }).error;
          if (typeof message === 'string' && message.trim()) return message;
        }
      } catch { }
    }
    if (maybeError?.context?.text) {
      try {
        const body = await maybeError.context.text();
        if (body.trim()) return body;
      } catch { }
    }
    if (typeof maybeError?.message === 'string' && maybeError.message.trim()) return maybeError.message;
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