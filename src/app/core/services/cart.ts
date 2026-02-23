import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartItem, CartSummary } from '../models/cart-item';
import { SupabaseAuthService } from './supabase-auth.service';

const LEGACY_CART_KEY = 'telcel_cart';
const GUEST_CART_KEY = 'telcel_cart_guest';
const USER_CART_PREFIX = 'telcel_cart_user_';
const FREE_SHIPPING_THRESHOLD = 1000;
const SHIPPING_COST = 150;

@Injectable({ providedIn: 'root' })
export class CartService {
  private platformId = inject(PLATFORM_ID);
  private supabaseAuth = inject(SupabaseAuthService);
  private items = signal<CartItem[]>([]);
  private storageKey = GUEST_CART_KEY;

  readonly cartItems = this.items.asReadonly();
  readonly itemCount = computed(() => this.items().reduce((sum, i) => sum + i.cantidad, 0));
  readonly subtotal = computed(() => this.items().reduce((sum, i) => sum + i.precio * i.cantidad, 0));
  readonly shipping = computed(() => this.subtotal() >= FREE_SHIPPING_THRESHOLD ? 0 : this.items().length > 0 ? SHIPPING_COST : 0);
  readonly total = computed(() => this.subtotal() + this.shipping());

  readonly summary = computed<CartSummary>(() => ({
    items: this.items(),
    subtotal: this.subtotal(),
    envio: this.shipping(),
    total: this.total(),
    cantidad_total: this.itemCount()
  }));

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.migrateLegacyStorage();
    this.storageKey = this.keyForUser(this.supabaseAuth.currentUser?.id ?? null);
    this.items.set(this.readFromStorage(this.storageKey));

    this.supabaseAuth.session$.subscribe({
      next: (session) => this.handleSessionChange(session?.user?.id ?? null),
    });
  }

  addItem(item: CartItem): void {
    const current = this.items();
    const existing = current.find(i => i.id_producto === item.id_producto);
    if (existing) {
      const newQty = Math.min(existing.cantidad + item.cantidad, item.stock);
      this.items.set(current.map(i => i.id_producto === item.id_producto ? { ...i, cantidad: newQty } : i));
    } else {
      this.items.set([...current, { ...item, cantidad: Math.min(item.cantidad, item.stock) }]);
    }
    this.saveToStorage();
  }

  updateQuantity(productId: string | number, cantidad: number): void {
    if (cantidad <= 0) { this.removeItem(productId); return; }
    this.items.set(this.items().map(i => i.id_producto === productId ? { ...i, cantidad: Math.min(cantidad, i.stock) } : i));
    this.saveToStorage();
  }

  removeItem(productId: string | number): void {
    this.items.set(this.items().filter(i => i.id_producto !== productId));
    this.saveToStorage();
  }

  clear(): void {
    this.items.set([]);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(this.storageKey, JSON.stringify(this.items()));
  }

  private readFromStorage(key: string): CartItem[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed as CartItem[] : [];
    } catch {
      return [];
    }
  }

  private handleSessionChange(userId: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const nextKey = this.keyForUser(userId);
    if (nextKey === this.storageKey) return;

    const previousKey = this.storageKey;
    const previousItems = this.readFromStorage(previousKey);
    const nextItems = this.readFromStorage(nextKey);

    if (previousKey === GUEST_CART_KEY && !!userId) {
      const merged = this.mergeItems(nextItems, previousItems);
      this.storageKey = nextKey;
      this.items.set(merged);
      localStorage.setItem(nextKey, JSON.stringify(merged));
      localStorage.removeItem(GUEST_CART_KEY);
      return;
    }

    this.storageKey = nextKey;
    this.items.set(nextItems);
  }

  private keyForUser(userId: string | null): string {
    return userId ? `${USER_CART_PREFIX}${userId}` : GUEST_CART_KEY;
  }

  private migrateLegacyStorage(): void {
    const legacy = localStorage.getItem(LEGACY_CART_KEY);
    if (!legacy || localStorage.getItem(GUEST_CART_KEY)) return;

    localStorage.setItem(GUEST_CART_KEY, legacy);
    localStorage.removeItem(LEGACY_CART_KEY);
  }

  private mergeItems(base: CartItem[], extra: CartItem[]): CartItem[] {
    const merged = new Map<CartItem['id_producto'], CartItem>();

    for (const item of base) {
      merged.set(item.id_producto, { ...item });
    }

    for (const item of extra) {
      const current = merged.get(item.id_producto);
      if (!current) {
        merged.set(item.id_producto, { ...item });
        continue;
      }

      const maxStock = Math.max(current.stock, item.stock);
      merged.set(item.id_producto, {
        ...current,
        stock: maxStock,
        cantidad: Math.min(current.cantidad + item.cantidad, maxStock),
      });
    }

    return Array.from(merged.values());
  }
}
