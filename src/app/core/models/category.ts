export interface Category {
  id_categoria: string | number;
  nombre: string;
  descripcion: string;
  imagen: string;
}

export interface Subcategory {
  id_subcategoria: string | number;
  id_categoria: string | number;
  nombre: string;
}
