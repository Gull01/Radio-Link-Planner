import { Component, signal, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { ConfirmService } from '../../services/confirm.service';
import { POI, Connection, AnalysisStats } from '../../models/poi.model';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.css']
})
export class ChatComponent {
  chatService = inject(ChatService);
  confirmService = inject(ConfirmService);
  
  // Context inputs from parent
  pois = input<POI[]>([]);
  connections = input<Connection[]>([]);
  stats = input<AnalysisStats | null>(null);
  selectedConnection = input<Connection | null>(null);
  
  isOpen = signal<boolean>(false);
  showSettings = signal<boolean>(false);
  messages = signal<ChatMessage[]>([]);
  userInput = signal<string>('');
  isLoading = signal<boolean>(false);
  apiKey = signal<string>('');
  
  suggestedQuestions = [
    "What's the ideal tower height for a 10km link?",
    "Explain Fresnel zone clearance",
    "Why is my signal strength low?",
    "What device should I use for this connection?",
    "How can I improve line of sight?"
  ];

  ngOnInit(): void {
    this.apiKey.set(this.chatService.getApiKey());
    this.messages.set(this.chatService.getConversationHistory());
  }

  toggleChat(): void {
    this.isOpen.update(v => !v);
    if (this.isOpen() && this.messages().length === 0) {
      // Show welcome message
      this.addSystemMessage("👋 Hi! I'm your Radio Planning Assistant. Ask me anything about RF links, signal optimization, or device recommendations!");
    }
  }

  toggleSettings(): void {
    this.showSettings.update(v => !v);
  }

  saveApiKey(): void {
    const key = this.apiKey().trim();
    if (key) {
      this.chatService.setApiKey(key);
      this.showSettings.set(false);
      this.addSystemMessage("✅ API key saved! You can now chat with me.");
    }
  }

  sendMessage(): void {
    const message = this.userInput().trim();
    if (!message || this.isLoading()) return;

    this.userInput.set('');
    this.isLoading.set(true);

    const context = this.stats() ? {
      pois: this.pois(),
      connections: this.connections(),
      stats: this.stats()!,
      selectedConnection: this.selectedConnection() || undefined
    } : undefined;

    this.chatService.sendMessage(message, context).subscribe({
      next: (response) => {
        this.messages.set(this.chatService.getConversationHistory());
        this.isLoading.set(false);
        this.scrollToBottom();
      },
      error: (error) => {
        console.error('Chat error:', error);
        this.isLoading.set(false);
        this.addSystemMessage("❌ Failed to send message. Please try again.");
      }
    });

    this.messages.set(this.chatService.getConversationHistory());
    this.scrollToBottom();
  }

  askSuggested(question: string): void {
    this.userInput.set(question);
    this.sendMessage();
  }

  async clearChat(): Promise<void> {
    const confirmed = await this.confirmService.confirm(
      'Clear chat history?',
      'Clear',
      'Cancel'
    );
    
    if (confirmed) {
      this.chatService.clearHistory();
      this.messages.set([]);
      this.addSystemMessage("🔄 Chat history cleared. How can I help you?");
    }
  }

  private addSystemMessage(content: string): void {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: content,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, msg]);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const chatBody = document.querySelector('.chat-messages');
      if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }, 100);
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
