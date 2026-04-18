export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  videoUrl: string | null;
  createdAt: string | null;
  deletedAt: string | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: string | null;
  deletedAt: string | null;
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
  videoUrl: string | null;
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
  deletedAt: string | null;
  items: AdminOrderItem[];
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  shippingStatus: string | null; // ✅
}

export interface TrackingEvent {
  status: string;
  description: string;
  location: string;
  date: string;
  completed: boolean; // ✅
}

export interface TrackingResult {
  trackingNumber: string;
  carrier: string;
  status: string;
  trackingUrl?: string | null;
  events: TrackingEvent[];
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
  deletedAt: string | null;
}