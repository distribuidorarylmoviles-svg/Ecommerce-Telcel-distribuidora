import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { Product, ProductListResponse } from '../models/product';
import { Category } from '../models/category';
import { Banner } from '../models/banner';
import { MOCK_BANNERS } from './mock-data';
import { SupabaseService } from './supabase.service';

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

type DbCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string | null;
};

@Injectable({ providedIn: 'root' })
export class ProductService {
  private static readonly PAGE_SIZE = 24;
  private static readonly PRODUCT_SELECT =
    'id, name, description, price, category, image_url, stock, created_at';

  // null = desconocido, true = columna existe, false = migración pendiente
  private deletedAtAvailable: boolean | null = null;

  constructor(private supabaseService: SupabaseService) {}

  getProducts(params: {
    pagina?: number;
    buscar?: string;
    categoria?: string;
  } = {}): Observable<ProductListResponse> {
    return from(this.fetchProducts(params));
  }

  getProduct(id: string): Observable<{ success: boolean; producto?: Product }> {
    return from(this.fetchProduct(id));
  }

  getCategories(): Observable<{ success: boolean; categorias: Category[] }> {
    return from(this.fetchCategories());
  }

  getBanners(): Observable<{ success: boolean; banners: Banner[] }> {
    return of({ success: true, banners: MOCK_BANNERS });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private isMissingDeletedAt(msg: string): boolean {
    const m = msg.toLowerCase();
    return m.includes('deleted_at');
  }

  private mapProduct(row: DbProductRow): Product {
    const category = row.category?.trim() || 'General';
    const imageUrl = row.image_url?.trim() || '';
    return {
      id_producto: row.id,
      nombre: row.name?.trim() || 'Producto',
      marca: category,
      color: '',
      descripcion: row.description?.trim() || '',
      detalles_adicional: '',
      precio: this.toNumber(row.price, 0),
      stock: Math.max(0, Math.floor(this.toNumber(row.stock, 0))),
      id_categoria: 0,
      id_subcategoria: 0,
      tipo_producto: category,
      estado: 'nuevo',
      imagen_principal: imageUrl,
      imagenes: imageUrl
        ? [{ id_imagen: 1, id_producto: row.id, url_imagen: imageUrl, principal: true }]
        : [],
    };
  }

  private toNumber(value: number | string | null | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  // ─── Producto único ──────────────────────────────────────────────────────

  private async fetchProduct(id: string): Promise<{ success: boolean; producto?: Product }> {
    const supabase = this.supabaseService.getClient();

    // Con filtro deleted_at (si la migración ya fue ejecutada)
    if (this.deletedAtAvailable !== false) {
      const { data, error } = await supabase
        .from('products')
        .select(ProductService.PRODUCT_SELECT)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!error) {
        this.deletedAtAvailable = true;
        if (!data) return { success: false };
        return { success: true, producto: this.mapProduct(data as DbProductRow) };
      }

      if (this.isMissingDeletedAt(error.message ?? '')) {
        // Migración no ejecutada → reintento sin filtro
        this.deletedAtAvailable = false;
      } else {
        throw new Error(error.message || 'No se pudo cargar el producto.');
      }
    }

    // Sin filtro deleted_at (migración pendiente)
    const { data, error } = await supabase
      .from('products')
      .select(ProductService.PRODUCT_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message || 'No se pudo cargar el producto.');
    if (!data) return { success: false };
    return { success: true, producto: this.mapProduct(data as DbProductRow) };
  }

  // ─── Lista de productos ──────────────────────────────────────────────────

  private async fetchProducts(params: {
    pagina?: number;
    buscar?: string;
    categoria?: string;
  }): Promise<ProductListResponse> {
    const supabase = this.supabaseService.getClient();
    const page = params.pagina ?? 1;
    const search = params.buscar?.trim() ?? '';
    const category = params.categoria?.trim() ?? '';
    const rangeFrom = (page - 1) * ProductService.PAGE_SIZE;
    const rangeTo = page * ProductService.PAGE_SIZE - 1;

    const applyFilters = (base: ReturnType<typeof supabase.from>) => {
      let q = base
        .select(ProductService.PRODUCT_SELECT, { count: 'exact' });
      if (category) q = (q as any).eq('category', category);
      if (search) q = (q as any).or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      return (q as any)
        .order('created_at', { ascending: false })
        .range(rangeFrom, rangeTo);
    };

    // Con filtro deleted_at
    if (this.deletedAtAvailable !== false) {
      const base = (supabase.from('products') as any).is('deleted_at', null);
      const { data, error, count } = await applyFilters(base);

      if (!error) {
        this.deletedAtAvailable = true;
        return this.buildListResponse(data, count, page);
      }

      if (this.isMissingDeletedAt((error as { message?: string }).message ?? '')) {
        this.deletedAtAvailable = false;
      } else {
        throw new Error((error as { message?: string }).message || 'No se pudieron cargar los productos.');
      }
    }

    // Sin filtro deleted_at (migración pendiente)
    const { data, error, count } = await applyFilters(supabase.from('products'));
    if (error) throw new Error((error as { message?: string }).message || 'No se pudieron cargar los productos.');
    return this.buildListResponse(data, count, page);
  }

  private buildListResponse(
    data: unknown,
    count: number | null,
    page: number,
  ): ProductListResponse {
    const rows = (data ?? []) as DbProductRow[];
    const total = count ?? rows.length;
    return {
      success: true,
      productos: rows.map((row) => this.mapProduct(row)),
      total,
      pagina_actual: page,
      total_paginas: Math.max(1, Math.ceil(total / ProductService.PAGE_SIZE)),
    };
  }

  // ─── Categorías ──────────────────────────────────────────────────────────

  private async fetchCategories(): Promise<{ success: boolean; categorias: Category[] }> {
    const supabase = this.supabaseService.getClient();

    // Con filtro deleted_at
    if (this.deletedAtAvailable !== false) {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, description, image_url, created_at')
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (!error) {
        this.deletedAtAvailable = true;
        return { success: true, categorias: this.mapCategories(data) };
      }

      const code = (error as { code?: string }).code;
      const msg = (error.message ?? '').toLowerCase();
      const missingTable = code === '42P01' || code === 'PGRST205' || msg.includes('could not find the table');
      if (missingTable) return { success: true, categorias: [] };

      if (this.isMissingDeletedAt(error.message ?? '')) {
        this.deletedAtAvailable = false;
      } else {
        throw new Error(error.message || 'No se pudieron cargar las categorías.');
      }
    }

    // Sin filtro deleted_at
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, description, image_url, created_at')
      .order('name', { ascending: true });

    if (error) {
      const code = (error as { code?: string }).code;
      const msg = (error.message ?? '').toLowerCase();
      const missingTable = code === '42P01' || code === 'PGRST205' || msg.includes('could not find the table');
      if (missingTable) return { success: true, categorias: [] };
      return { success: true, categorias: [] };
    }

    return { success: true, categorias: this.mapCategories(data) };
  }

  private mapCategories(data: unknown): Category[] {
    return ((data ?? []) as DbCategoryRow[]).map((row) => ({
      id_categoria: row.id,
      nombre: row.name,
      descripcion: row.description ?? '',
      imagen: '',
      image_url: row.image_url ?? '',
    }));
  }
}
