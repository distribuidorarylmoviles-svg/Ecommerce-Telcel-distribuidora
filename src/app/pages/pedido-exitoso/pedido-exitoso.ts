import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-pedido-exitoso',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pedido-exitoso.html',
  styleUrls: ['./pedido-exitoso.scss']
})
export class PedidoExitoso implements OnInit {
  sessionId: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.queryParamMap.get('session_id');
  }
}