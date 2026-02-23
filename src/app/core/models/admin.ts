export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  createdAt: string | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: string | null;
}

export interface AdminCategoryInput {
  name: string;
  description: string;
  imageUrl: string;
}

export interface AdminProductInput {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
}

export interface AdminOrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  priceAtPurchase: number;
}

export interface AdminOrder {
  id: string;
  userId: string | null;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  proofUrl: string | null;
  createdAt: string | null;
  items: AdminOrderItem[];
}

export interface AdminServiceRequest {
  id: string;
  serviceType: string;
  nombre: string;
  correoElectronico: string | null;
  telefonoCelular: string | null;
  comentario: string | null;
  payload: Record<string, unknown>;
  destinationEmail: string;
  emailSent: boolean;
  emailError: string | null;
  userId: string | null;
  createdAt: string | null;
}
