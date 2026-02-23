import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { ApiService } from './api';
import { Product, ProductListResponse } from '../models/product';
import { Category } from '../models/category';
import { Banner, ServiceItem } from '../models/banner';
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
  created_at: string | null;
};

type DbCategoryFromProductsRow = {
  category: string | null;
};

@Injectable({ providedIn: 'root' })
export class ProductService {
  private static readonly PAGE_SIZE = 24;

  constructor(
    private api: ApiService,
    private supabaseService: SupabaseService,
  ) {}

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

  getServices(): Observable<{ success: boolean; servicios: ServiceItem[] }> {
    return this.api.get<{ success: boolean; servicios: ServiceItem[] }>('servicios_publicos.php');
  }

  private async getProductsFromSupabase(params: {
    pagina?: number;
    buscar?: string;
    categoria?: string;
  }): Promise<ProductListResponse> {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('products')
      .select('id, name, description, price, category, image_url, stock, created_at', { count: 'exact' });

    const search = params.buscar?.trim() ?? '';
    const category = params.categoria?.trim() ?? '';

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(
        ((params.pagina ?? 1) - 1) * ProductService.PAGE_SIZE,
        (params.pagina ?? 1) * ProductService.PAGE_SIZE - 1
      );

    if (error) {
      throw new Error(error.message || 'No se pudieron cargar los productos.');
    }

    const rows = (data ?? []) as DbProductRow[];
    const total = count ?? rows.length;
    const totalPages = Math.max(1, Math.ceil(total / ProductService.PAGE_SIZE));
    const currentPage = params.pagina ?? 1;

    return {
      success: true,
      productos: rows.map((row) => this.mapProduct(row)),
      total,
      pagina_actual: currentPage,
      total_paginas: totalPages,
    };
  }

  private async getProductFromSupabase(id: string): Promise<{ success: boolean; producto?: Product }> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, category, image_url, stock, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'No se pudo cargar el producto.');
    }

    if (!data) {
      return { success: false };
    }

    return { success: true, producto: this.mapProduct(data as DbProductRow) };
  }

  private async getCategoriesFromSupabase(): Promise<{ success: boolean; categorias: Category[] }> {
    const supabase = this.supabaseService.getClient();
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, created_at')
      .order('name', { ascending: true });

    if (categoriesError) {
      const categoriesErrorCode = (categoriesError as { code?: string }).code;
      const categoriesErrorMessage = (categoriesError.message ?? '').toLowerCase();
      const missingCategoriesTable =
        categoriesErrorCode === '42P01' ||
        categoriesErrorCode === 'PGRST205' ||
        categoriesErrorMessage.includes('could not find the table');
      
      if (missingCategoriesTable) {
        return { success: true, categorias: [] };
      }
      throw new Error(categoriesError.message || 'No se pudieron cargar las categorías.');
    }

    const categorias: Category[] = ((categoriesData ?? []) as DbCategoryRow[]).map((row) => ({
      id_categoria: row.id,
      nombre: row.name,
      descripcion: '',
      imagen: '',
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
        ? [
            {
              id_imagen: 1,
              id_producto: row.id,
              url_imagen: imageUrl,
              principal: true,
            },
          ]
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
