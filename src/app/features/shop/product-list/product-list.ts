import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { Product } from '../../../core/models/product';
import { Category } from '../../../core/models/category';

@Component({
  selector: 'app-product-list',
  imports: [FormsModule, ProductCard],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductList implements OnInit {
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  displayedProducts: Product[] = [];
  categories: Category[] = [];
  searchTerm = '';
  selectedCategory: string | null = null;
  currentPage = 1;
  totalPages = 1;
  totalProducts = 0;
  loading = false;

  ngOnInit(): void {
    this.productService.getCategories().subscribe({
      next: (res) => { if (res.success) this.categories = res.categorias; }
    });

    this.route.queryParams.subscribe(params => {
      this.selectedCategory =
        typeof params['categoria'] === 'string' && params['categoria'].trim()
          ? params['categoria'].trim()
          : null;
      this.searchTerm =
        typeof params['buscar'] === 'string' && params['buscar'].trim()
          ? params['buscar'].trim()
          : '';
      this.currentPage =
        typeof params['pagina'] === 'string' && Number(params['pagina']) > 0
          ? Math.floor(Number(params['pagina']))
          : 1;
      this.loadProducts();
    });
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getProducts({
      pagina: this.currentPage,
      buscar: this.searchTerm || undefined,
      categoria: this.selectedCategory || undefined,
    }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.displayedProducts = res.productos;
          this.totalPages = res.total_paginas;
          this.totalProducts = res.total;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      error: () => this.loading = false
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    void this.updateRouteState();
  }

  filterByCategory(category: string | null): void {
    if (this.selectedCategory === category) {
      this.selectedCategory = null;
    } else {
      this.selectedCategory = category;
    }
    this.currentPage = 1;
    void this.updateRouteState();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = null;
    this.currentPage = 1;
    void this.updateRouteState();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    void this.updateRouteState();
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  private async updateRouteState(): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        buscar: this.searchTerm.trim() || null,
        categoria: this.selectedCategory || null,
        pagina: this.currentPage > 1 ? this.currentPage : null,
      },
      queryParamsHandling: 'merge',
    });
  }
}
