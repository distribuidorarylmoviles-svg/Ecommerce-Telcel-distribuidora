import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product';
import { Product } from '../../core/models/product';
import { Banner } from '../../core/models/banner';
import { Category } from '../../core/models/category';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCard, CommonModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class Home implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  banners = signal<Banner[]>([]);
  featuredProducts = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  readonly services = [
    {
      id: 'planes',
      icon: 'fas fa-wifi',
      title: 'Planes de Internet',
      description:
        'Encuentra el plan perfecto para ti. Navega con la mejor cobertura y atención personalizada.',
      features: ['Cobertura nacional', 'Planes flexibles', 'Asesoría personalizada'],
      cta: 'Ver planes',
      route: '/servicios/planes',
    },
    {
      id: 'portabilidad',
      icon: 'fas fa-exchange-alt',
      title: 'Portabilidad',
      description:
        'Cámbiate a Telcel y conserva tu número actual. El proceso es rápido y sin costo.',
      features: ['Conserva tu número', 'Trámite ágil', 'Acompañamiento en todo el proceso'],
      cta: 'Solicitar portabilidad',
      route: '/servicios/portabilidad',
    },
    {
      id: 'recuperacion',
      icon: 'fas fa-redo-alt',
      title: 'Recuperación de Número',
      description:
        'Si perdiste tu chip o teléfono, te ayudamos a recuperar tu línea con soporte directo.',
      features: ['Mantén tu número', 'Atención inmediata', 'Soporte con ejecutivo'],
      cta: 'Recuperar número',
      route: '/servicios/recuperacion',
    },
  ] as const;

  currentBannerIndex = signal(0);
  private sliderInterval: any;

  ngOnInit(): void {
    this.productService.getBanners().subscribe(res => {
      this.banners.set(res.banners);
      this.startSlider();
    });
    this.productService.getProducts({ pagina: 1 }).subscribe(res => this.featuredProducts.set(res.productos.slice(0, 20)));
    this.productService.getCategories().subscribe(res => this.categories.set(res.categorias));
  }

  ngOnDestroy(): void {
    this.stopSlider();
  }

  startSlider() {
    this.stopSlider();
    this.sliderInterval = setInterval(() => {
      this.nextBanner();
    }, 5000);
  }

  stopSlider() {
    if (this.sliderInterval) {
      clearInterval(this.sliderInterval);
    }
  }

  nextBanner() {
    if (this.banners().length > 0) {
      this.currentBannerIndex.update(idx => (idx + 1) % this.banners().length);
    }
  }

  prevBanner() {
    if (this.banners().length > 0) {
      this.currentBannerIndex.update(idx => (idx - 1 + this.banners().length) % this.banners().length);
    }
  }

  setBanner(index: number) {
    this.currentBannerIndex.set(index);
    this.startSlider(); // Reset interval
  }

  get heroBanner(): Banner | null {
    const banners = this.banners();
    return banners.length > 0 ? banners[this.currentBannerIndex()] : null;
  }
}
