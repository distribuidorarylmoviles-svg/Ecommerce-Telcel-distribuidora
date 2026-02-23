export interface CartItem {
  id_producto: string | number;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen: string;
  stock: number;
}

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  envio: number;
  total: number;
  cantidad_total: number;
}
