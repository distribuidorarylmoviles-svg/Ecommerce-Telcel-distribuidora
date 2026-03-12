export interface Product {
  id_producto: string | number;
  nombre: string;
  marca: string;
  color: string;
  descripcion: string;
  detalles_adicional: string;
  precio: number;
  stock: number;
  id_categoria: number;
  id_subcategoria: number;
  tipo_producto: string;
  estado: string;
  imagenes?: ProductImage[];
  imagen_principal?: string;
  video_url?: string | null; // ✅
}

export interface ProductImage {
  id_imagen: number;
  id_producto: string | number;
  url_imagen: string;
  principal: boolean;
}

export interface ProductListResponse {
  success: boolean;
  productos: Product[];
  total: number;
  pagina_actual: number;
  total_paginas: number;
}