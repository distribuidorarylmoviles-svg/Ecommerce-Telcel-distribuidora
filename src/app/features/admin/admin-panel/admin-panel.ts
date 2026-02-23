import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminCategory,
  AdminCategoryInput,
  AdminOrder,
  AdminProduct,
  AdminProductInput,
  AdminServiceRequest,
} from '../../../core/models/admin';
import { AdminService } from '../../../core/services/admin';

type AdminTab = 'productos' | 'categorias' | 'compras' | 'solicitudes';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss',
})
export class AdminPanel implements OnInit {
  private adminService = inject(AdminService);

  readonly activeTab = signal<AdminTab>('productos');
  readonly products = signal<AdminProduct[]>([]);
  readonly categories = signal<AdminCategory[]>([]);
  readonly orders = signal<AdminOrder[]>([]);
  readonly serviceRequests = signal<AdminServiceRequest[]>([]);

  readonly productsLoading = signal(false);
  readonly categoriesLoading = signal(false);
  readonly ordersLoading = signal(false);
  readonly requestsLoading = signal(false);
  readonly savingProduct = signal(false);
  readonly savingCategory = signal(false);
  readonly deletingCategoryId = signal<string | null>(null);
  readonly resendingRequestId = signal<string | null>(null);
  readonly deletingRequestId = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  editingProductId: string | null = null;
  productForm: AdminProductInput = this.emptyProductForm();
  categoryForm: AdminCategoryInput = this.emptyCategoryForm();

  readonly metrics = computed(() => ({
    products: this.products().length,
    categories: this.categories().length,
    orders: this.orders().length,
    requests: this.serviceRequests().length,
  }));

  ngOnInit(): void {
    void Promise.all([
      this.loadProducts(),
      this.loadCategories(),
      this.loadOrders(),
      this.loadServiceRequests(),
    ]);
  }

  selectTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    this.clearFeedback();
  }

  async refreshActiveTab(): Promise<void> {
    if (this.activeTab() === 'productos') {
      await this.loadProducts();
      return;
    }

    if (this.activeTab() === 'compras') {
      await this.loadOrders();
      return;
    }

    if (this.activeTab() === 'categorias') {
      await this.loadCategories();
      return;
    }

    await this.loadServiceRequests();
  }

  editProduct(product: AdminProduct): void {
    this.editingProductId = product.id;
    this.productForm = {
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      stock: product.stock,
      imageUrl: product.imageUrl,
    };
    this.clearFeedback();
  }

  cancelProductEdition(): void {
    this.resetProductForm();
  }

  async saveProduct(): Promise<void> {
    const name = this.productForm.name.trim();
    if (!name) {
      this.errorMessage.set('El nombre del producto es obligatorio.');
      return;
    }

    if (Number(this.productForm.price) < 0) {
      this.errorMessage.set('El precio no puede ser negativo.');
      return;
    }

    if (Number(this.productForm.stock) < 0) {
      this.errorMessage.set('El stock no puede ser negativo.');
      return;
    }

    this.savingProduct.set(true);
    this.clearFeedback();

    try {
      await this.adminService.saveProduct(
        {
          ...this.productForm,
          name,
          description: this.productForm.description.trim(),
          category: this.productForm.category.trim(),
          imageUrl: this.productForm.imageUrl.trim(),
          price: Number(this.productForm.price),
          stock: Math.floor(Number(this.productForm.stock)),
        },
        this.editingProductId ?? undefined,
      );

      this.statusMessage.set(
        this.editingProductId ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.',
      );
      this.resetProductForm();
      await this.loadProducts();
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo guardar el producto.'));
    } finally {
      this.savingProduct.set(false);
    }
  }

  async saveCategory(): Promise<void> {
    const name = this.categoryForm.name.trim();
    if (!name) {
      this.errorMessage.set('El nombre de la categoría es obligatorio.');
      return;
    }

    this.savingCategory.set(true);
    this.clearFeedback();

    try {
      await this.adminService.createCategory({
        ...this.categoryForm,
        name,
        description: this.categoryForm.description.trim(),
        imageUrl: this.categoryForm.imageUrl.trim(),
      });
      this.statusMessage.set('Categoría creada correctamente.');
      this.categoryForm = this.emptyCategoryForm();
      await this.loadCategories();
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo crear la categoría.'));
    } finally {
      this.savingCategory.set(false);
    }
  }

  async deleteCategory(category: AdminCategory): Promise<void> {
    const accepted =
      typeof window !== 'undefined'
        ? window.confirm(
            `¿Eliminar la categoría "${category.name}"? Los productos asociados quedarán sin categoría.`,
          )
        : false;

    if (!accepted) return;

    this.clearFeedback();
    this.deletingCategoryId.set(category.id);

    try {
      await this.adminService.deleteCategory(category.id);
      this.statusMessage.set('Categoría eliminada correctamente.');
      if (this.productForm.category.trim() === category.name.trim()) {
        this.productForm = { ...this.productForm, category: '' };
      }
      await Promise.all([this.loadCategories(), this.loadProducts()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo eliminar la categoría.'));
    } finally {
      this.deletingCategoryId.set(null);
    }
  }

  async deleteAllCategories(): Promise<void> {
    const accepted =
      typeof window !== 'undefined'
        ? window.confirm(
            '¿ELIMINAR TODAS LAS CATEGORÍAS? Esta acción desvinculará todos los productos y no se puede deshacer.',
          )
        : false;

    if (!accepted) return;

    this.clearFeedback();
    this.categoriesLoading.set(true);

    try {
      await this.adminService.deleteAllCategories();
      this.statusMessage.set('Todas las categorías han sido eliminadas.');
      this.productForm = { ...this.productForm, category: '' };
      await Promise.all([this.loadCategories(), this.loadProducts()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudieron eliminar todas las categorías.'));
    } finally {
      this.categoriesLoading.set(false);
    }
  }

  async deleteProduct(product: AdminProduct): Promise<void> {
    const accepted =
      typeof window !== 'undefined'
        ? window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)
        : false;

    if (!accepted) return;

    this.clearFeedback();
    try {
      await this.adminService.deleteProduct(product.id);
      this.statusMessage.set('Producto eliminado correctamente.');
      if (this.editingProductId === product.id) {
        this.resetProductForm();
      }
      await this.loadProducts();
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo eliminar el producto.'));
    }
  }

  async deleteServiceRequest(request: AdminServiceRequest): Promise<void> {
    const accepted =
      typeof window !== 'undefined'
        ? window.confirm(`¿Eliminar la solicitud de "${request.nombre}"? Esta acción no se puede deshacer.`)
        : false;

    if (!accepted) return;

    this.clearFeedback();
    this.deletingRequestId.set(request.id);

    try {
      await this.adminService.deleteServiceRequest(request.id);
      this.statusMessage.set('Solicitud eliminada correctamente.');
      await this.loadServiceRequests();
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo eliminar la solicitud.'));
    } finally {
      this.deletingRequestId.set(null);
    }
  }

  async resendServiceRequest(request: AdminServiceRequest): Promise<void> {
    this.clearFeedback();
    this.resendingRequestId.set(request.id);

    try {
      await this.adminService.resendServiceRequestEmail(request.id, request.destinationEmail);
      this.statusMessage.set('Correo reenviado correctamente.');
      await this.loadServiceRequests();
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo reenviar el correo.'));
    } finally {
      this.resendingRequestId.set(null);
    }
  }

  serviceLabel(type: string): string {
    if (type === 'planes') return 'Planes de Internet';
    if (type === 'portabilidad') return 'Portabilidad';
    if (type === 'recuperacion') return 'Recuperación de Número';
    return type;
  }

  requestStatusLabel(request: AdminServiceRequest): string {
    if (request.emailSent) return 'Correo enviado';
    if (request.emailError) return 'Correo con error';
    return 'Registrada';
  }

  requestStatusIsError(request: AdminServiceRequest): boolean {
    return !request.emailSent && !!request.emailError;
  }

  payloadEntries(payload: Record<string, unknown>): Array<{ key: string; value: string }> {
    return Object.entries(payload).map(([key, value]) => ({
      key,
      value: value === null ? 'null' : typeof value === 'string' ? value : JSON.stringify(value),
    }));
  }

  private async loadProducts(): Promise<void> {
    this.productsLoading.set(true);
    try {
      this.products.set(await this.adminService.getProducts());
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudieron cargar los productos.'));
    } finally {
      this.productsLoading.set(false);
    }
  }

  private async loadCategories(): Promise<void> {
    this.categoriesLoading.set(true);
    try {
      this.categories.set(await this.adminService.getCategories());
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudieron cargar las categorías.'));
    } finally {
      this.categoriesLoading.set(false);
    }
  }

  private async loadOrders(): Promise<void> {
    this.ordersLoading.set(true);
    try {
      this.orders.set(await this.adminService.getOrders());
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudieron cargar las compras.'));
    } finally {
      this.ordersLoading.set(false);
    }
  }

  private async loadServiceRequests(): Promise<void> {
    this.requestsLoading.set(true);
    try {
      this.serviceRequests.set(await this.adminService.getServiceRequests());
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudieron cargar las solicitudes.'));
    } finally {
      this.requestsLoading.set(false);
    }
  }

  private emptyProductForm(): AdminProductInput {
    return {
      name: '',
      description: '',
      price: 0,
      category: '',
      stock: 0,
      imageUrl: '',
    };
  }

  private emptyCategoryForm(): AdminCategoryInput {
    return {
      name: '',
      description: '',
      imageUrl: '',
    };
  }

  private clearFeedback(): void {
    this.statusMessage.set(null);
    this.errorMessage.set(null);
  }

  private resetProductForm(): void {
    this.editingProductId = null;
    this.productForm = this.emptyProductForm();
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
    return fallback;
  }
}
