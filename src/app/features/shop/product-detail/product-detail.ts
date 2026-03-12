import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from '../../../core/services/product';
import { CartService } from '../../../core/services/cart';
import { Product } from '../../../core/models/product';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './product-detail.html',
  styleUrls: ['./product-detail.scss'],
})
export class ProductDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private cdr = inject(ChangeDetectorRef);

  product: Product | null = null;
  selectedImage = '';
  quantity = 1;
  loading = true;
  loadError = false;
  addedToCart = false;
  showVideo = false; // ✅

  toImgUrl(filename: string): string {
    if (!filename) return '/no-image.png';
    if (filename.startsWith('http')) return filename;
    if (filename.startsWith('../')) return '/' + filename.substring(3);
    return '/productosImg/' + filename;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.loading = false;
      this.loadError = true;
      return;
    }

    this.productService.getProduct(id).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.producto) {
          this.product = res.producto;
          this.selectedImage = this.toImgUrl(res.producto.imagen_principal || '');
          this.showVideo = false;
        } else {
          this.loadError = true;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      },
    });
  }

  selectImage(url: string): void {
    this.selectedImage = this.toImgUrl(url);
    this.showVideo = false; // ✅
  }

  decrementQty(): void {
    if (this.quantity > 1) this.quantity--;
  }

  incrementQty(): void {
    if (this.product && this.quantity < this.product.stock) this.quantity++;
  }

  addToCart(): void {
    if (!this.product || this.product.stock <= 0) return;
    this.cartService.addItem({
      id_producto: this.product.id_producto,
      nombre: this.product.nombre,
      precio: this.product.precio,
      cantidad: this.quantity,
      imagen: this.toImgUrl(this.product.imagen_principal || ''),
      stock: this.product.stock,
    });
    this.addedToCart = true;
    setTimeout(() => {
      this.addedToCart = false;
      this.cdr.markForCheck();
    }, 2000);
  }

  buyNow(): void {
    if (!this.product || this.product.stock <= 0) return;
    this.cartService.addItem({
      id_producto: this.product.id_producto,
      nombre: this.product.nombre,
      precio: this.product.precio,
      cantidad: this.quantity,
      imagen: this.toImgUrl(this.product.imagen_principal || ''),
      stock: this.product.stock,
    });
    void this.router.navigate(['/checkout']);
  }
}