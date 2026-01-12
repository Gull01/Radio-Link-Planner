import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { POI, Connection, AnalysisStats } from '../models/poi.model';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  
  // API key stored in localStorage (set via settings dialog)
  private apiKey = '';
  
  private conversationHistory: ChatMessage[] = [];

  constructor(private http: HttpClient) {}

  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('gemini_api_key', key);
  }

  getApiKey(): string {
    if (!this.apiKey) {
      this.apiKey = localStorage.getItem('gemini_api_key') || '';
    }
    return this.apiKey;
  }

  hasApiKey(): boolean {
    return !!this.getApiKey();
  }

  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  sendMessage(
    userMessage: string,
    projectContext?: {
      pois: POI[];
      connections: Connection[];
      stats: AnalysisStats;
      selectedConnection?: Connection;
    }
  ): Observable<string> {
    if (!this.hasApiKey()) {
      return of('Please set your Google Gemini API key first. Click the settings icon to add your key. Get a free key at: https://makersuite.google.com/app/apikey');
    }

    // Add user message to history
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    this.conversationHistory.push(userMsg);

    // Build context-aware system prompt
    const systemContext = this.buildSystemContext(projectContext);
    
    // Add instruction for natural responses
    const naturalPrompt = `You are a helpful radio link planning assistant. Respond naturally like a human expert - avoid excessive markdown formatting (**, __, --). Use simple, clear language. When listing items, use simple bullet points sparingly. Focus on being conversational and helpful.\n\n${systemContext}\n\nUser: ${userMessage}`;
    
    // Build conversation for Gemini API - simpler format
    const contents = [
      {
        parts: [
          { text: naturalPrompt }
        ]
      }
    ];

    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE'
        }
      ]
    };

    console.log('Sending request to Gemini API:', requestBody);

    return this.http.post<any>(
      `${this.GEMINI_API_URL}?key=${this.apiKey}`,
      requestBody
    ).pipe(
      map(response => {
        console.log('Gemini API Response:', response);
        
        // Try different response paths
        let aiResponse = '';
        
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            aiResponse = candidate.content.parts[0].text;
          }
        }
        
        if (!aiResponse) {
          console.error('Could not extract response from:', response);
          aiResponse = 'Sorry, I received an empty response. Please try again.';
        }
        
        // Add assistant message to history
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date()
        };
        this.conversationHistory.push(assistantMsg);
        
        return aiResponse;
      }),
      catchError(error => {
        console.error('Chat error details:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        console.error('Error response:', error.error);
        
        let errorMsg = 'Sorry, I encountered an error. ';
        
        if (error.status === 400) {
          errorMsg += 'Invalid request format. ';
          if (error.error?.error?.message) {
            errorMsg += error.error.error.message;
          }
        } else if (error.status === 429) {
          errorMsg += 'Rate limit exceeded. Please try again later.';
        } else if (error.status === 403) {
          errorMsg += 'Invalid API key. Please check your key.';
        } else if (error.status === 0) {
          errorMsg += 'Network error. Check your internet connection.';
        } else {
          errorMsg += `Error ${error.status}: ${error.error?.error?.message || 'Please try again later.'}`;
        }
        
        return of(errorMsg);
      })
    );
  }

  private buildSystemContext(projectContext?: {
    pois: POI[];
    connections: Connection[];
    stats: AnalysisStats;
    selectedConnection?: Connection;
  }): string {
    let context = `You are a Radio Link Planning Assistant helping users design and optimize wireless communication links.

Your expertise includes:
- Radio frequency (RF) propagation and path loss
- Line-of-sight (LOS) analysis and Fresnel zone clearance
- Tower height calculations and recommendations
- Device selection for WiFi, cellular, radio, and microwave links
- Signal strength optimization
- Troubleshooting connectivity issues
- Frequency band selection (2.4 GHz, 5 GHz, etc.)
- Antenna types and placement

Guidelines:
- Be concise but informative
- Use technical terms when appropriate but explain complex concepts
- Provide actionable recommendations
- Reference specific project data when available
- Use emojis sparingly for readability (📡 🗼 📊 ✅ ⚠️)

`;

    if (projectContext) {
      context += `\nCURRENT PROJECT CONTEXT:\n`;
      
      // Project stats
      context += `\nProject Statistics:
- Total Points: ${projectContext.stats.totalPoints}
- Total Connections: ${projectContext.stats.totalConnections}
- Maximum Distance: ${projectContext.stats.maxDistance.toFixed(2)} km
- Average Distance: ${projectContext.stats.averageDistance.toFixed(2)} km
`;

      // Points information
      if (projectContext.pois.length > 0) {
        context += `\nPoints of Interest:\n`;
        projectContext.pois.forEach((poi, idx) => {
          context += `${idx + 1}. ${poi.name}: (${poi.latitude.toFixed(6)}, ${poi.longitude.toFixed(6)}), Elevation: ${poi.elevation?.toFixed(0) || 'N/A'}m`;
          if (poi.towerHeight) {
            context += `, Tower Height: ${poi.towerHeight}m`;
          }
          context += `\n`;
        });
      }

      // Connections information
      if (projectContext.connections.length > 0) {
        context += `\nActive Connections:\n`;
        projectContext.connections.forEach((conn, idx) => {
          context += `${idx + 1}. ${conn.fromPOI.name} ↔ ${conn.toPOI.name}:
   - Distance: ${conn.distance.toFixed(2)} km
   - Signal Strength: ${conn.signalStrength.toFixed(1)}%
   - Line of Sight: ${conn.lineOfSight ? '✓ Clear' : '✗ Blocked'}
   - Clearance: ${conn.minClearance?.toFixed(1) || 'N/A'}m\n`;
        });
      }

      // Selected connection details
      if (projectContext.selectedConnection) {
        const conn = projectContext.selectedConnection;
        context += `\nCURRENTLY SELECTED CONNECTION:
${conn.fromPOI.name} ↔ ${conn.toPOI.name}
- Distance: ${conn.distance.toFixed(2)} km
- Signal Strength: ${conn.signalStrength.toFixed(1)}%
- Line of Sight: ${conn.lineOfSight ? 'Clear' : 'Blocked'}
- Minimum Clearance: ${conn.minClearance?.toFixed(1) || 'N/A'}m

The user may ask questions specifically about this connection.\n`;
      }
    } else {
      context += `\nNo project is currently loaded. Provide general radio link planning advice.\n`;
    }

    return context;
  }
}
