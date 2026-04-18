import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { ProductList } from './features/shop/product-list/product-list';
import { ProductDetail } from './features/shop/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Location } from './features/location/location';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Planes } from './features/services/planes/planes';
import { Portabilidad } from './features/services/portabilidad/portabilidad';
import { Recuperacion } from './features/services/recuperacion/recuperacion';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { AdminPanel } from './features/admin/admin-panel/admin-panel';
import { PedidoExitoso } from './pages/pedido-exitoso/pedido-exitoso';
//import { Rastrear } from './features/rastrear/rastrear';
import { ManualComponent } from './features/manual/manual.component'; // ← NUEVO

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'tienda', component: ProductList },
  { path: 'producto/:id', component: ProductDetail },
  { path: 'carrito', component: Cart },
  { path: 'checkout', component: Checkout },
  { path: 'login', component: Login },
  { path: 'registro', component: Register },
  { path: 'ubicacion', component: Location },
  { path: 'servicios/planes', component: Planes },
  { path: 'servicios/portabilidad', component: Portabilidad },
  { path: 'servicios/recuperacion', component: Recuperacion },
  { path: 'admin', component: AdminPanel, canActivate: [authGuard, adminGuard] },
  { path: 'recuperar-contrasena', component: ForgotPassword },
  { path: 'restablecer-contrasena', component: ResetPassword },
  { path: 'pedido-exitoso', component: PedidoExitoso },
  //{ path: 'rastrear', component: Rastrear },
  { path: 'manual', component: ManualComponent }, // ← NUEVO
  { path: '**', redirectTo: 'home' },
];