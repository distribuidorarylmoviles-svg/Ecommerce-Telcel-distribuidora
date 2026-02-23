import { Component, input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { Product } from '../../../core/models/product';
import { CartService } from '../../../core/services/cart';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './product-card.html',
  styleUrls: ['./product-card.scss'],
})
export class ProductCard {
  product = input.required<Product>();
  private cart = inject(CartService);
  private router = inject(Router);

  get imageUrl(): string {
    let img = this.product().imagen_principal;
    if (!img) return '/no-image.png';
    if (img.startsWith('http')) return img;
    if (img.startsWith('../')) return '/' + img.substring(3);
    return '/productosImg/' + img;
  }

  addToCart(event: Event): void {
    event.stopPropagation();
    const p = this.product();
    let img = p.imagen_principal || '';
    if (img) {
      if (img.startsWith('http')) {
        // img is already full URL
      } else if (img.startsWith('../')) {
        img = '/' + img.substring(3);
      } else {
        img = '/productosImg/' + img;
      }
    } else {
      img = '/no-image.png';
    }
    this.cart.addItem({ id_producto: p.id_producto, nombre: p.nombre, precio: p.precio, cantidad: 1, imagen: img, stock: p.stock });
  }

  viewDetail(): void {
    this.router.navigate(['/producto', this.product().id_producto]);
  }
}
