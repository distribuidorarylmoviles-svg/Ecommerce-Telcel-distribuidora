import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';

type Message = { role: 'user' | 'assistant'; content: string };

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss',
})
export class ChatbotComponent {
  constructor(private supabaseService: SupabaseService) {}

  isOpen = signal(false);
  messages = signal<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy el asistente de R y L Móviles. ¿En qué te puedo ayudar?' }
  ]);
  inputText = signal('');
  loading = signal(false);

  toggleChat() {
    this.isOpen.set(!this.isOpen());
  }

  async sendMessage() {
    const text = this.inputText().trim();
    if (!text || this.loading()) return;

    this.messages.update(msgs => [...msgs, { role: 'user', content: text }]);
    this.inputText.set('');
    this.loading.set(true);

    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase.functions.invoke('chatbot', {
        body: { messages: this.messages() },
      });

      if (error) throw error;

      this.messages.update(msgs => [...msgs, { role: 'assistant', content: data.reply }]);
    } catch {
      this.messages.update(msgs => [...msgs, { role: 'assistant', content: 'Lo siento, ocurrió un error. Intenta de nuevo.' }]);
    } finally {
      this.loading.set(false);
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendMessage();
    }
  }
}