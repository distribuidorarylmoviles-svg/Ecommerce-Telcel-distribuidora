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
import { AdminService, StoreInfo } from '../../../core/services/admin';
import { ExportService } from '../../../core/services/export';

type AdminTab = 'productos' | 'categorias' | 'compras' | 'solicitudes' | 'ubicacion' | 'papelera';
type ExportFormat = 'csv' | 'excel' | 'pdf';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss',
})
export class AdminPanel implements OnInit {
  private adminService = inject(AdminService);
  private exportService = inject(ExportService);

  readonly activeTab = signal<AdminTab>('productos');
  readonly products = signal<AdminProduct[]>([]);
  readonly categories = signal<AdminCategory[]>([]);
  readonly orders = signal<AdminOrder[]>([]);
  readonly serviceRequests = signal<AdminServiceRequest[]>([]);
  readonly storeInfo = signal<StoreInfo | null>(null);

  // Papelera
  readonly deletedProducts = signal<AdminProduct[]>([]);
  readonly deletedCategories = signal<AdminCategory[]>([]);
  readonly deletedServiceRequests = signal<AdminServiceRequest[]>([]);

  readonly productsLoading = signal(false);
  readonly categoriesLoading = signal(false);
  readonly ordersLoading = signal(false);
  readonly requestsLoading = signal(false);
  readonly storeInfoLoading = signal(false);
  readonly trashLoading = signal(false);
  readonly savingProduct = signal(false);
  readonly savingCategory = signal(false);
  readonly savingStoreInfo = signal(false);
  readonly deletingCategoryId = signal<string | null>(null);
  readonly resendingRequestId = signal<string | null>(null);
  readonly deletingRequestId = signal<string | null>(null);
  readonly restoringId = signal<string | null>(null);
  readonly permanentDeletingId = signal<string | null>(null);
  readonly exportingFormat = signal<ExportFormat | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  editingProductId: string | null = null;
  productForm: AdminProductInput = this.emptyProductForm();
  categoryForm: AdminCategoryInput = this.emptyCategoryForm();
  storeForm: StoreInfo = this.emptyStoreForm();

  readonly trashCount = computed(
    () =>
      this.deletedProducts().length +
      this.deletedCategories().length +
      this.deletedServiceRequests().length,
  );

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
      this.loadStoreInfo(),
      this.loadTrash(),
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
    if (this.activeTab() === 'ubicacion') {
      await this.loadStoreInfo();
      return;
    }
    if (this.activeTab() === 'papelera') {
      await this.loadTrash();
      return;
    }
    await this.loadServiceRequests();
  }

  // ─── Productos ───────────────────────────────────────────────────────────

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
    // Scroll al editor para que sea visible en cualquier tamaño de pantalla
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        document.getElementById('product-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
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

  async deleteProduct(product: AdminProduct): Promise<void> {
    const accepted = typeof window !== 'undefined'
      ? window.confirm(`¿Mover "${product.name}" a la papelera? Podrás restaurarlo desde la pestaña Papelera.`)
      : false;

    if (!accepted) return;

    this.clearFeedback();
    try {
      await this.adminService.deleteProduct(product.id);
      this.statusMessage.set('Producto movido a la papelera.');
      if (this.editingProductId === product.id) {
        this.resetProductForm();
      }
      await Promise.all([this.loadProducts(), this.reloadDeletedProducts()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo eliminar el producto.'));
    }
  }

  // ─── Categorías ──────────────────────────────────────────────────────────

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
    const accepted = typeof window !== 'undefined'
      ? window.confirm(`¿Mover "${category.name}" a la papelera? Podrás restaurarla desde la pestaña Papelera.`)
      : false;

    if (!accepted) return;

    this.clearFeedback();
    this.deletingCategoryId.set(category.id);

    try {
      await this.adminService.deleteCategory(category.id);
      this.statusMessage.set('Categoría movida a la papelera.');
      if (this.productForm.category.trim() === category.name.trim()) {
        this.productForm = { ...this.productForm, category: '' };
      }
      await Promise.all([this.loadCategories(), this.loadProducts(), this.reloadDeletedCategories()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo eliminar la categoría.'));
    } finally {
      this.deletingCategoryId.set(null);
    }
  }

  async deleteAllCategories(): Promise<void> {
    const accepted = typeof window !== 'undefined'
      ? window.confirm('¿Mover TODAS LAS CATEGORÍAS a la papelera? Podrás restaurarlas desde la pestaña Papelera.')
      : false;

    if (!accepted) return;

    this.clearFeedback();
    this.categoriesLoading.set(true);

    try {
      await this.adminService.deleteAllCategories();
      this.statusMessage.set('Todas las categorías han sido movidas a la papelera.');
      this.productForm = { ...this.productForm, category: '' };
      await Promise.all([this.loadCategories(), this.loadProducts(), this.reloadDeletedCategories()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudieron eliminar todas las categorías.'));
    } finally {
      this.categoriesLoading.set(false);
    }
  }

  // ─── Solicitudes ─────────────────────────────────────────────────────────

  async deleteServiceRequest(request: AdminServiceRequest): Promise<void> {
    const accepted = typeof window !== 'undefined'
      ? window.confirm(`¿Mover la solicitud de "${request.nombre}" a la papelera?`)
      : false;

    if (!accepted) return;

    this.clearFeedback();
    this.deletingRequestId.set(request.id);

    try {
      await this.adminService.deleteServiceRequest(request.id);
      this.statusMessage.set('Solicitud movida a la papelera.');
      await Promise.all([this.loadServiceRequests(), this.reloadDeletedServiceRequests()]);
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

  // ─── Papelera ────────────────────────────────────────────────────────────

  async restoreProduct(product: AdminProduct): Promise<void> {
    this.clearFeedback();
    this.restoringId.set(product.id);
    try {
      await this.adminService.restoreProduct(product.id);
      this.statusMessage.set(`"${product.name}" restaurado correctamente.`);
      await Promise.all([this.loadProducts(), this.reloadDeletedProducts()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo restaurar el producto.'));
    } finally {
      this.restoringId.set(null);
    }
  }

  async restoreCategory(category: AdminCategory): Promise<void> {
    this.clearFeedback();
    this.restoringId.set(category.id);
    try {
      await this.adminService.restoreCategory(category.id);
      this.statusMessage.set(`Categoría "${category.name}" restaurada correctamente.`);
      await Promise.all([this.loadCategories(), this.loadProducts(), this.reloadDeletedCategories()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo restaurar la categoría.'));
    } finally {
      this.restoringId.set(null);
    }
  }

  async restoreServiceRequest(request: AdminServiceRequest): Promise<void> {
    this.clearFeedback();
    this.restoringId.set(request.id);
    try {
      await this.adminService.restoreServiceRequest(request.id);
      this.statusMessage.set(`Solicitud de "${request.nombre}" restaurada correctamente.`);
      await Promise.all([this.loadServiceRequests(), this.reloadDeletedServiceRequests()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo restaurar la solicitud.'));
    } finally {
      this.restoringId.set(null);
    }
  }

  async permanentlyDeleteProduct(product: AdminProduct): Promise<void> {
    const accepted = typeof window !== 'undefined'
      ? window.confirm(`¿Eliminar permanentemente "${product.name}"? Esta acción no se puede deshacer.`)
      : false;
    if (!accepted) return;

    this.clearFeedback();
    this.permanentDeletingId.set(product.id);
    try {
      await this.adminService.permanentlyDeleteProduct(product.id);
      this.statusMessage.set('Producto eliminado permanentemente.');
      await this.reloadDeletedProducts();
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo eliminar el producto.'));
    } finally {
      this.permanentDeletingId.set(null);
    }
  }

  async permanentlyDeleteCategory(category: AdminCategory): Promise<void> {
    const accepted = typeof window !== 'undefined'
      ? window.confirm(`¿Eliminar permanentemente "${category.name}"? Los productos asociados quedarán sin categoría.`)
      : false;
    if (!accepted) return;

    this.clearFeedback();
    this.permanentDeletingId.set(category.id);
    try {
      await this.adminService.permanentlyDeleteCategory(category.id);
      this.statusMessage.set('Categoría eliminada permanentemente.');
      await Promise.all([this.loadProducts(), this.reloadDeletedCategories()]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo eliminar la categoría.'));
    } finally {
      this.permanentDeletingId.set(null);
    }
  }

  async permanentlyDeleteServiceRequest(request: AdminServiceRequest): Promise<void> {
    const accepted = typeof window !== 'undefined'
      ? window.confirm(`¿Eliminar permanentemente la solicitud de "${request.nombre}"? Esta acción no se puede deshacer.`)
      : false;
    if (!accepted) return;

    this.clearFeedback();
    this.permanentDeletingId.set(request.id);
    try {
      await this.adminService.permanentlyDeleteServiceRequest(request.id);
      this.statusMessage.set('Solicitud eliminada permanentemente.');
      await this.reloadDeletedServiceRequests();
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo eliminar la solicitud.'));
    } finally {
      this.permanentDeletingId.set(null);
    }
  }

  async emptyTrash(): Promise<void> {
    if (this.trashCount() === 0) return;
    const accepted = typeof window !== 'undefined'
      ? window.confirm(`¿Vaciar la papelera? Se eliminarán permanentemente ${this.trashCount()} elementos. Esta acción no se puede deshacer.`)
      : false;
    if (!accepted) return;

    this.clearFeedback();
    this.trashLoading.set(true);
    try {
      await this.adminService.emptyTrash();
      this.statusMessage.set('Papelera vaciada correctamente.');
      this.deletedProducts.set([]);
      this.deletedCategories.set([]);
      this.deletedServiceRequests.set([]);
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo vaciar la papelera.'));
    } finally {
      this.trashLoading.set(false);
    }
  }

  // ─── Exportación ─────────────────────────────────────────────────────────

  async exportTab(format: ExportFormat): Promise<void> {
    this.clearFeedback();
    this.exportingFormat.set(format);

    try {
      const tab = this.activeTab();
      const dateStr = new Date().toISOString().slice(0, 10);

      if (tab === 'productos') {
        const { headers, rows } = this.adminService.getProductsExportData(this.products());
        await this.runExport(format, `productos_${dateStr}`, 'Productos', headers, rows);
      } else if (tab === 'categorias') {
        const { headers, rows } = this.adminService.getCategoriesExportData(this.categories());
        await this.runExport(format, `categorias_${dateStr}`, 'Categorías', headers, rows);
      } else if (tab === 'compras') {
        const { headers, rows } = this.adminService.getOrdersExportData(this.orders());
        await this.runExport(format, `compras_${dateStr}`, 'Compras', headers, rows);
      } else if (tab === 'solicitudes') {
        const { headers, rows } = this.adminService.getServiceRequestsExportData(this.serviceRequests());
        await this.runExport(format, `solicitudes_${dateStr}`, 'Solicitudes', headers, rows);
      }

      this.statusMessage.set('Archivo exportado correctamente.');
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo exportar el archivo.'));
    } finally {
      this.exportingFormat.set(null);
    }
  }

  canExportCurrentTab(): boolean {
    const tab = this.activeTab();
    return tab === 'productos' || tab === 'categorias' || tab === 'compras' || tab === 'solicitudes';
  }

  // ─── Tienda ──────────────────────────────────────────────────────────────

  async saveStoreInfo(): Promise<void> {
    this.savingStoreInfo.set(true);
    this.clearFeedback();

    try {
      await this.adminService.updateStoreInfo(this.storeForm);
      this.statusMessage.set('Información de la tienda actualizada correctamente.');
      await this.loadStoreInfo();
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo actualizar la información.'));
    } finally {
      this.savingStoreInfo.set(false);
    }
  }

  // ─── Helpers de vista ────────────────────────────────────────────────────

  // true cuando el producto editado tiene una categoría que ya está en papelera
  productCategoryIsInTrash(): boolean {
    const cat = this.productForm.category.trim();
    return !!cat && !this.categories().some((c) => c.name === cat);
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

  // ─── Carga de datos ──────────────────────────────────────────────────────

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

  private async loadStoreInfo(): Promise<void> {
    this.storeInfoLoading.set(true);
    try {
      const info = await this.adminService.getStoreInfo();
      this.storeInfo.set(info);
      if (info) this.storeForm = { ...info };
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error, 'No se pudo cargar la información de la tienda.'));
    } finally {
      this.storeInfoLoading.set(false);
    }
  }

  private async loadTrash(): Promise<void> {
    this.trashLoading.set(true);
    // allSettled: si una sección falla (ej. columna aún no migrada) las demás siguen cargando
    const [p, c, s] = await Promise.allSettled([
      this.adminService.getDeletedProducts(),
      this.adminService.getDeletedCategories(),
      this.adminService.getDeletedServiceRequests(),
    ]);
    if (p.status === 'fulfilled') this.deletedProducts.set(p.value);
    if (c.status === 'fulfilled') this.deletedCategories.set(c.value);
    if (s.status === 'fulfilled') this.deletedServiceRequests.set(s.value);
    this.trashLoading.set(false);
  }

  private async reloadDeletedProducts(): Promise<void> {
    try {
      this.deletedProducts.set(await this.adminService.getDeletedProducts());
    } catch {
      // error silencioso: no afecta el flujo principal
    }
  }

  private async reloadDeletedCategories(): Promise<void> {
    try {
      this.deletedCategories.set(await this.adminService.getDeletedCategories());
    } catch {
      // error silencioso: no afecta el flujo principal
    }
  }

  private async reloadDeletedServiceRequests(): Promise<void> {
    try {
      this.deletedServiceRequests.set(await this.adminService.getDeletedServiceRequests());
    } catch {
      // error silencioso: no afecta el flujo principal
    }
  }

  private async runExport(
    format: ExportFormat,
    filename: string,
    title: string,
    headers: string[],
    rows: (string | number)[][],
  ): Promise<void> {
    if (format === 'csv') {
      this.exportService.exportToCsv(filename, headers, rows);
    } else if (format === 'excel') {
      await this.exportService.exportToExcel(filename, title, headers, rows);
    } else {
      await this.exportService.exportToPdf(filename, title, headers, rows);
    }
  }

  private emptyProductForm(): AdminProductInput {
    return { name: '', description: '', price: 0, category: '', stock: 0, imageUrl: '' };
  }

  private emptyCategoryForm(): AdminCategoryInput {
    return { name: '', description: '', imageUrl: '' };
  }

  private emptyStoreForm(): StoreInfo {
    return {
      id: 1,
      telefono: '',
      correo: '',
      whatsapp: '',
      horario_dias: '',
      horario_horas: '',
      direccion: '',
      maps_embed_url: '',
      maps_link: '',
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
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error;
    return fallback;
  }
}
