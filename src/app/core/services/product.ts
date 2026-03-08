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

  // true cuando ya se confirmó que la columna deleted_at existe
  private deletedAtReady: boolean | null = null;

  constructor(private supabaseService: SupabaseService) {}

  getProducts(params: {
    pagina?: number;
    buscar?: string;
    categoria?: string;
  } = {}): Observable<ProductListResponse> {
    return from(this.getProductsFromSupabase(params));
  }

  getProduct(id: string): Observable<{ success: boolean; producto?: Product }> {
    return from(this.getProductFromSupabase(id));
  }

  getCategories(): Observable<{ success: boolean; categorias: Category[] }> {
    return from(this.getCategoriesFromSupabase());
  }

  getBanners(): Observable<{ success: boolean; banners: Banner[] }> {
    return of({ success: true, banners: MOCK_BANNERS });
  }

  // Detecta si el error es por columna deleted_at inexistente (migración pendiente)
  private isMissingColumn(msg: string): boolean {
    const lower = msg.toLowerCase();
    return lower.includes('deleted_at') || lower.includes('column') && lower.includes('does not exist');
  }

  private async getProductsFromSupabase(params: {
    pagina?: number;
    buscar?: string;
    categoria?: string;
  }): Promise<ProductListResponse> {
    const supabase = this.supabaseService.getClient();
    const page = params.pagina ?? 1;
    const search = params.buscar?.trim() ?? '';
    const category = params.categoria?.trim() ?? '';

    const buildQuery = (withDeletedFilter: boolean) => {
      let q = supabase
        .from('products')
        .select('id, name, description, price, category, image_url, stock, created_at', { count: 'exact' });

      if (withDeletedFilter) q = q.is('deleted_at', null);
      if (category) q = q.eq('category', category);
      if (search) q = q.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

      return q
        .order('created_at', { ascending: false })
        .range((page - 1) * ProductService.PAGE_SIZE, page * ProductService.PAGE_SIZE - 1);
    };

    let result = await buildQuery(this.deletedAtReady !== false);

    // Si falla por columna inexistente, reintenta sin el filtro
    if (result.error && this.isMissingColumn(result.error.message ?? '')) {
      this.deletedAtReady = false;
      result = await buildQuery(false);
    } else if (!result.error) {
      this.deletedAtReady = true;
    }

    if (result.error) {
      throw new Error(result.error.message || 'No se pudieron cargar los productos.');
    }

    const rows = (result.data ?? []) as DbProductRow[];
    const total = result.count ?? rows.length;
    const totalPages = Math.max(1, Math.ceil(total / ProductService.PAGE_SIZE));

    return {
      success: true,
      productos: rows.map((row) => this.mapProduct(row)),
      total,
      pagina_actual: page,
      total_paginas: totalPages,
    };
  }

  private async getProductFromSupabase(id: string): Promise<{ success: boolean; producto?: Product }> {
    const supabase = this.supabaseService.getClient();

    const buildQuery = (withDeletedFilter: boolean) => {
      let q = supabase
        .from('products')
        .select('id, name, description, price, category, image_url, stock, created_at')
        .eq('id', id);
      if (withDeletedFilter) q = q.is('deleted_at', null);
      return q.maybeSingle();
    };

    let result = await buildQuery(this.deletedAtReady !== false);

    if (result.error && this.isMissingColumn(result.error.message ?? '')) {
      this.deletedAtReady = false;
      result = await buildQuery(false);
    } else if (!result.error) {
      this.deletedAtReady = true;
    }

    if (result.error) {
      throw new Error(result.error.message || 'No se pudo cargar el producto.');
    }

    if (!result.data) return { success: false };

    return { success: true, producto: this.mapProduct(result.data as DbProductRow) };
  }

  private async getCategoriesFromSupabase(): Promise<{ success: boolean; categorias: Category[] }> {
    const supabase = this.supabaseService.getClient();

    const buildQuery = (withDeletedFilter: boolean) => {
      let q = supabase
        .from('categories')
        .select('id, name, description, image_url, created_at');
      if (withDeletedFilter) q = q.is('deleted_at', null);
      return q.order('name', { ascending: true });
    };

    let result = await buildQuery(this.deletedAtReady !== false);

    if (result.error) {
      const code = (result.error as { code?: string }).code;
      const msg = (result.error.message ?? '').toLowerCase();

      const missingTable = code === '42P01' || code === 'PGRST205' || msg.includes('could not find the table');
      if (missingTable) return { success: true, categorias: [] };

      if (this.isMissingColumn(msg)) {
        this.deletedAtReady = false;
        result = await buildQuery(false);
        if (result.error) return { success: true, categorias: [] };
      } else {
        throw new Error(result.error.message || 'No se pudieron cargar las categorías.');
      }
    } else {
      this.deletedAtReady = true;
    }

    const categorias: Category[] = ((result.data ?? []) as DbCategoryRow[]).map((row) => ({
      id_categoria: row.id,
      nombre: row.name,
      descripcion: row.description ?? '',
      imagen: '',
      image_url: row.image_url ?? '',
    }));

    return { success: true, categorias };
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
}
