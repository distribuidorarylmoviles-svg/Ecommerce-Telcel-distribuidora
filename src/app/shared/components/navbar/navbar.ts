import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import { CartService } from '../../../core/services/cart';
import { ProductService } from '../../../core/services/product';
import { Category } from '../../../core/models/category';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
})
export class Navbar implements OnInit {
  auth = inject(AuthService);
  cart = inject(CartService);
  private productService = inject(ProductService);
  private router = inject(Router);
  categories = signal<Category[]>([]);
  searchQuery = '';

  ngOnInit(): void {
    this.productService.getCategories().subscribe({
      next: (res) => this.categories.set(res.categorias),
      error: () => {}
    });
  }

  search(): void {
    const query = this.searchQuery.trim();
    this.router.navigate(['/tienda'], {
      queryParams: {
        buscar: query || null,
        categoria: null,
        pagina: null,
      },
    });
  }
}
