import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PedidoExitoso } from './pedido-exitoso';

describe('PedidoExitoso', () => {
  let component: PedidoExitoso;
  let fixture: ComponentFixture<PedidoExitoso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PedidoExitoso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PedidoExitoso);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
