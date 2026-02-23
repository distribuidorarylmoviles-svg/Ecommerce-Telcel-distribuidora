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
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, category, image_url, stock, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'No se pudieron cargar los productos.');
    }

    let rows = (data ?? []) as DbProductRow[];
    const search = params.buscar?.trim().toLowerCase() ?? '';
    const category = params.categoria?.trim().toLowerCase() ?? '';

    if (category) {
      rows = rows.filter((row) => (row.category ?? '').trim().toLowerCase() === category);
    }

    if (search) {
      rows = rows.filter((row) => {
        const name = row.name?.toLowerCase() ?? '';
        const description = row.description?.toLowerCase() ?? '';
        return name.includes(search) || description.includes(search);
      });
    }

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / ProductService.PAGE_SIZE));
    const requestedPage = Math.max(1, Math.floor(params.pagina ?? 1));
    const currentPage = Math.min(requestedPage, totalPages);
    const startIndex = (currentPage - 1) * ProductService.PAGE_SIZE;
    const pagedRows = rows.slice(startIndex, startIndex + ProductService.PAGE_SIZE);

    return {
      success: true,
      productos: pagedRows.map((row) => this.mapProduct(row)),
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

    if (!categoriesError) {
      const categorias: Category[] = ((categoriesData ?? []) as DbCategoryRow[]).map((row) => ({
        id_categoria: row.id,
        nombre: row.name,
        descripcion: '',
        imagen: '',
      }));
      return { success: true, categorias };
    }

    const categoriesErrorCode = (categoriesError as { code?: string }).code;
    const categoriesErrorMessage = (categoriesError.message ?? '').toLowerCase();
    const missingCategoriesTable =
      categoriesErrorCode === '42P01' ||
      categoriesErrorCode === 'PGRST205' ||
      categoriesErrorMessage.includes('could not find the table');
    if (!missingCategoriesTable) {
      throw new Error(categoriesError.message || 'No se pudieron cargar las categorías.');
    }

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('category')
      .order('category', { ascending: true });

    if (productsError) {
      throw new Error(productsError.message || 'No se pudieron cargar las categorías.');
    }

    const categoryNames = Array.from(
      new Set(
        ((productsData ?? []) as DbCategoryFromProductsRow[])
          .map((row) => (row.category ?? '').trim())
          .filter((name) => !!name),
      ),
    );

    categoryNames.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    const categorias: Category[] = categoryNames.map((name, index) => ({
      id_categoria: index + 1,
      nombre: name,
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
