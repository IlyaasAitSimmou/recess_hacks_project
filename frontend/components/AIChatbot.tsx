"use client";

import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { notesStore, type Note } from '@/lib/notesStore';
import FileSelector from './FileSelector';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  actions?: NoteAction[];
}

interface NoteAction {
  type: 'create' | 'edit' | 'format' | 'diagram';
  title?: string;
  content?: string;
  noteId?: number;
  folderId?: number | null;
  // diagram-specific
  target?: 'new' | 'append';
  diagram?: string;
  // edit-specific
  mode?: 'append' | 'replace' | 'remove';
  find?: string;
  replaceWith?: string;
}

// Note type comes from notesStore

interface AIChatbotProps {
  currentNote: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onNoteUpdate?: () => void; // Callback to refresh notes
}

export default function AIChatbot({ currentNote, isOpen, onClose, onNoteUpdate }: AIChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [allNotesSnapshot, setAllNotesSnapshot] = useState<Note[]>(notesStore.getAllNotes());
  const [selectedNote, setSelectedNote] = useState<Note | null>(currentNote);
  const [isVideoMode, setIsVideoMode] = useState(false);

  useEffect(() => {
    // Keep an up-to-date snapshot of all notes for AI context
    const unsub = notesStore.subscribe(() => setAllNotesSnapshot(notesStore.getAllNotes()));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add enhanced welcome message
      const welcomeMessage: Message = {
        id: 'welcome',
        content: `🤖 **Advanced AI Assistant Ready!**\n\nI can help you with:\n\n📝 **Note Management**\n• Create new notes with rich formatting\n• Edit existing notes\n• Organize your content\n\n🧮 **Mathematical Content**\n• LaTeX equations: $E = mc^2$\n• Complex formulas: $\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$\n• Scientific notation\n\n🎨 **Rich Formatting**\n• **Bold**, *italic*, and other styles\n• Headers and lists\n• Font sizes and colors\n\n📊 **Diagrams & Visuals**\n• ASCII diagrams\n• Flowcharts\n• Process diagrams\n\nI have access to ALL your notes and can work with them directly. Just ask me to create, edit, or enhance any content!`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize Gemini model
  function getModel() {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || 'eee';
    const ai = new GoogleGenerativeAI(apiKey);
    return ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  // Prompt engineering: return structured JSON actions only
  function buildSystemInstruction() {
    const notesContext = allNotesSnapshot.map(n => ({ id: n.id, title: n.title, folder_id: n.folder_id, content: n.content })).slice(0, 50);
    const selectedNoteInfo = selectedNote ? `SELECTED NOTE: ID ${selectedNote.id}, Title: "${selectedNote.title}"` : 'NO NOTE SELECTED';
    
    return `You are an AI note assistant with full write access. You MUST return only JSON matching this schema in your response, no prose:
{
  "actions": [
    {"type":"create","title":string,"content":string,"folderId": number|null},
    {"type":"edit","noteId?":number,"title?":string,"content":string,"mode?":"append|replace|remove","find?":string,"replaceWith?":string},
    {"type":"format","noteId":number,"content":string},
    {"type":"diagram","target":"new|append","noteId?":number,"title?":string,"diagram": string}
  ]
}

IMPORTANT NOTE SELECTION RULES:
- ${selectedNoteInfo}
- If a note is selected (noteId provided above), ALWAYS use "edit" action with that noteId unless the user explicitly asks to create a new note
- Only use "create" action when NO note is selected OR user explicitly requests a new note
- When editing, set noteId to the selected note's ID: ${selectedNote?.id ?? 'null'}

Rules:
- Use HTML for headings/lists/formatting with inline CSS as desired (font-size, color, bold/italic, etc.).
- For math, embed LaTeX between $$ ... $$ blocks anywhere in the HTML.
- For diagrams:
  • Choose the diagram type by context (DON'T default to flowcharts):
    – Math functions/equations → <pre><code class="language-plot">...</code></pre>
    – Physical vectors/forces/arrows → <pre><code class="language-vector">...</code></pre>
    – Molecules/chemistry → <pre><code class="language-chem">...</code></pre>
    – Workflows/steps/process/sequence/class → <pre><code class="language-mermaid">...</code></pre>
  • Math plots (like Desmos) → use <pre><code class="language-plot">...</code></pre> with syntax:
    plot\n
    f(x) = sin(x)\n
    g(x) = x^2 - 4\n
    domain: -10..10
  • Vectors/physics → use <pre><code class="language-vector">...</code></pre> with syntax:
    vector\n
    axes: -10..10 x -10..10\n
    vec (0,0) -> (3,4) label: v
  • Chemistry (molecules/reactions) → use <pre><code class="language-chem">...</code></pre> with syntax:
    chem\n
    benzene
  Ensure one diagram per code block and correct language class.
- Keep content readable and self-contained. No outer <html> or <body> tags.
- For edits, set "mode" to one of: append (add under existing content), remove (delete provided snippet), replace (use with "find" and "replaceWith" to change parts). Avoid replacing entire files.
- Never include markdown explanations outside the JSON. Return only JSON.

Mermaid Syntax Rules (CRITICAL - Follow exactly):
✅ USE: graph LR, flowchart TD, sequenceDiagram, classDiagram
✅ USE: A[Label], B{Decision}, C(Process)
✅ USE: -->, -->|text|, -.->, ==>>
✅ USE: Simple math in labels: A[x^2 - 4]

✅ COMPLEX FEATURES (with proper syntax):
✅ USE: subgraph "Title" ... end (with proper quotes and spacing)
✅ USE: style Node fill:#color,stroke:#color,stroke-width:2px (with proper spacing)
✅ USE: Coordinates like A[(-2, 0)] (with proper spacing)

❌ AVOID: Missing quotes, improper spacing, malformed syntax

Example of reliable complex diagram formatting:
<pre><code class="language-mermaid">graph LR
  A[(-2, 0)] -- B((0, -4)) -- C[(2, 0)]
  style B fill:#ccf,stroke:#f66,stroke-width:2px
  subgraph "Parabola: x^2 - 4"
    A
    B
    C
  end</code></pre>

When creating complex diagrams, ensure proper spacing, quotes, and syntax formatting.

Note: The GraphRenderer parses language-mermaid, language-plot, language-vector, and language-chem blocks.`;
  }

  async function callAI(userText: string): Promise<NoteAction[]> {
    const model = getModel();
    const input = `${buildSystemInstruction()}\n\nUSER: ${userText}`;
    const result = await model.generateContent(input);
    const text = result.response.text();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.actions)) return parsed.actions as NoteAction[];
    } catch (e) {
      // Try to salvage JSON from code fences
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed?.actions)) return parsed.actions as NoteAction[];
        } catch {}
      }
    }
    return [];
  }

  // Enhanced message sending with note actions handled client-side
  const sendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText ?? inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: textToSend,
      isUser: true,
      timestamp: new Date(),
    };

    setIsLoading(true);
    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setInputMessage('');

    try {
      // Check if we're in video mode
      if (isVideoMode) {
        // Handle video creation
        const processingMessage: Message = {
          id: `video-processing-${Date.now()}`,
          content: `🎬 **Creating Video: "${textToSend}"**\n\nStep 1: Analyzing topic and creating comprehensive script...\nStep 2: Generating Manim animation code...\nStep 3: Rendering video with animations...\n\n⏳ This may take a few minutes. Please wait...`,
          isUser: false,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, processingMessage]);
        
        // Create the video
        await createVideoLesson(textToSend);
        return;
      }

      // Regular note editing mode - call AI to process the message
      const actions = await callAI(userMessage.content);

      if (actions.length) {
        const targetNote = selectedNote; // Ensure the selected note is used

        if (targetNote) {
          console.log('AI Actions:', actions);
          await processNoteActions(actions, userMessage.content, targetNote);
        } else {
          // If no note is selected, check if the AI wants to create a new note
          const hasCreateAction = actions.some(action => action.type === 'create');
          
          if (hasCreateAction) {
            console.log('[AI] Processing create actions without selected note');
            await processNoteActions(actions, userMessage.content, null);
          } else {
            console.log('[AI] No note selected. Prompting user to select a file.');
            const notify: Message = {
              id: 'ai-no-target-' + Date.now().toString(),
              isUser: false,
              timestamp: new Date(),
              content: `Please select a file to edit, or I can create a new note for you. Just ask me to create something!`,
            };
            setMessages((prev) => [...prev, notify]);
          }
        }
      } else {
        // If no actions returned, provide a general response
        const generalContent = await callAIForContent(userMessage.content);
        
        if (generalContent.trim()) {
          // Create a new note with the AI response if no note is selected
          if (!selectedNote) {
            const newNote = notesStore.createNote(
              `AI Response - ${new Date().toLocaleDateString()}`,
              generalContent,
              null
            );
            
            const responseMessage: Message = {
              id: 'ai-response-' + Date.now().toString(),
              isUser: false,
              timestamp: new Date(),
              content: `I've created a new note with my response: **${newNote.title}**`,
            };
            setMessages((prev) => [...prev, responseMessage]);
          } else {
            // Add to existing note
            const currentContent = selectedNote.content || '';
            const updatedNote = notesStore.updateNote(selectedNote.id, {
              content: currentContent + '\n\n' + generalContent
            });
            
            if (updatedNote) {
              const responseMessage: Message = {
                id: 'ai-response-' + Date.now().toString(),
                isUser: false,
                timestamp: new Date(),
                content: `I've added my response to your note: **${updatedNote.title}**`,
              };
              setMessages((prev) => [...prev, responseMessage]);
            }
          }
          
          onNoteUpdate?.();
        } else {
          // Fallback response
          const fallbackMessage: Message = {
            id: 'ai-fallback-' + Date.now().toString(),
            isUser: false,
            timestamp: new Date(),
            content: `I understand you want help with: "${userMessage.content}". Could you be more specific about what you'd like me to create or edit?`,
          };
          setMessages((prev) => [...prev, fallbackMessage]);
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'AI error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelection = (note: Note | null) => {
    setSelectedNote(note);
  };

  // Try to select a target note based on current selection or fuzzy title match in user text
  function pickTargetNoteId(userText: string): number | null {
    console.log('[AI] pickTargetNoteId input:', { userText, currentNoteId: currentNote?.id });

    // Prefer current note when available (explicit user context)
    if (currentNote?.id) {
      console.log('[AI] pickTargetNoteId -> using currentNote.id', currentNote.id);
      return currentNote.id;
    }

    const text = userText.toLowerCase();

    // Try quoted title first: edit "Some Title"
    const quoted = userText.match(/"([^"]+)"|'([^']+)'/);
    const explicitTitle = quoted?.[1] || quoted?.[2] || extractTitlePhrase(userText);

    if (explicitTitle) {
      // Check for exact match first
      const exact = allNotesSnapshot.find(n => (n.title || '').toLowerCase() === explicitTitle.toLowerCase());
      if (exact) {
        console.log('[AI] Exact match found for title:', explicitTitle);
        return exact.id;
      }
    }

    // Fuzzy match against titles, but require a higher confidence threshold
    let bestNote: Note | undefined;
    let bestScore = 0;
    for (const n of allNotesSnapshot) {
      const t = (n.title || '').toLowerCase();
      if (!t) continue;
      const s = stringSimilarity((explicitTitle || text), t);
      if (s > bestScore) {
        bestScore = s;
        bestNote = n;
      }
    }

    // Only choose a fuzzy match if similarity >= 0.6; else return null to indicate no confident target.
    const result = (bestScore >= 0.6 && bestNote) ? bestNote.id : null;
    console.log('[AI] pickTargetNoteId result:', { bestScore, bestNoteId: bestNote?.id ?? null, returned: result });

    if (!result) {
      console.log('[AI] No confident match found. Prompting user for clarification.');
      const clarificationMessage: Message = {
        id: 'ai-clarify-' + Date.now().toString(),
        isUser: false,
        timestamp: new Date(),
        content: `I couldn't confidently determine which note to edit. Please specify the note title or ensure a note is selected.`,
      };
      setMessages((prev) => [...prev, clarificationMessage]);
    }

    return result;
  }

  function extractTitlePhrase(s: string): string | null {
    const patterns = [
      /(?:in|into|to) (?:the )?note(?: called| titled| named)?\s+([\w\s-]{2,})/i,
      /(?:edit|update|change|append)\s+([\w\s-]{2,})/i,
    ];
    for (const rx of patterns) {
      const m = s.match(rx);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  }

  // Simple Dice coefficient for fuzzy matching
  function stringSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    a = a.replace(/\s+/g, ' ').trim();
    b = b.replace(/\s+/g, ' ').trim();
    if (a === b) return 1;
    const bigrams = (s: string) => {
      const arr: string[] = [];
      for (let i = 0; i < s.length - 1; i++) arr.push(s.slice(i, i + 2));
      return arr;
    };
    const A = new Map<string, number>();
    for (const g of bigrams(a)) A.set(g, (A.get(g) || 0) + 1);
    const B = new Map<string, number>();
    for (const g of bigrams(b)) B.set(g, (B.get(g) || 0) + 1);
    let overlap = 0;
    for (const [g, c] of A) overlap += Math.min(c, B.get(g) || 0);
    const total = Array.from(A.values()).reduce((s, x) => s + x, 0) + Array.from(B.values()).reduce((s, x) => s + x, 0);
    return total ? (2 * overlap) / total : 0;
  }

  function inferEditMode(userText: string): 'append' | 'replace' | 'remove' {
    const t = userText.toLowerCase();
    if (/(add|append|insert|extend|below|under)/.test(t)) return 'append';
    if (/(remove|delete|erase|strip out)/.test(t)) return 'remove';
    if (/(replace|overwrite|swap)/.test(t)) return 'replace';
    return 'append';
  }

  // Content-only generation: ask the model to return HTML with LaTeX and Mermaid code fences
  async function callAIForContent(userText: string, noteId?: number | null): Promise<string> {
    try {
      const model = getModel();
      const noteTitle = allNotesSnapshot.find(n => n.id === noteId!)?.title || currentNote?.title || '';
      const system = `You are a helpful note writer. Return VALID HTML only (no markdown), suitable for a rich-text editor.
Requirements:
- Use headings, paragraphs, lists.
- Include LaTeX between $$ ... $$ where appropriate.
- For diagrams, choose the most appropriate type and wrap it in the correct code fence:
  • Math plots → <pre><code class="language-plot">...</code></pre>
  • Physics vectors → <pre><code class="language-vector">...</code></pre>
  • Chemistry (use common names or formulas ONLY; do NOT use SMILES) → <pre><code class="language-chem">chem\nbenzene</code></pre> (replace with requested molecule)
  • Workflows/sequence/class → <pre><code class="language-mermaid">...</code></pre>
- Use SIMPLE, reliable syntax.
- Keep content readable and self-contained. No outer <html> or <body> tags.
- When creating diagrams, make them meaningful and well-structured.
- IMPORTANT: Diagrams will NOT render unless they are wrapped in <pre><code class="language-mermaid">...</code></pre> tags.

Mermaid Syntax Rules (IMPORTANT):
- Use basic syntax: graph LR, flowchart TD, sequenceDiagram
- AVOID: subgraph, style commands, complex styling, coordinates
- Keep nodes simple: A[Label], B{Decision}, C(Process)
- Use basic arrows: -->, -->|text|, -.->, ==>>
- For math content, use LaTeX in node labels: A[x^2 - 4]

Example of reliable diagram formatting:
<pre><code class="language-mermaid">graph LR
  A[x^2 - 4] --> B{x = 0?}
  B -->|Yes| C[y = -4]
  B -->|No| D[y = x^2 - 4]
  C --> E[Vertex at (0, -4)]
  D --> F[Parabola]</code></pre>

When creating diagrams, keep them simple and avoid complex styling that might cause rendering issues.`;
      const prompt = `${system}\n\nTopic/Instruction: ${userText}\n${noteTitle ? `Target note title: ${noteTitle}` : ''}`;
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      
      console.log('AI generated content:', text);
      
      // If model returned code fences or markdown, keep as-is; editor will normalize/render
      return text?.trim() || '';
    } catch (error) {
      console.error('Error generating AI content:', error);
      return '';
    }
  }

  // Process note actions from AI
  const processNoteActions = async (actions: NoteAction[], userText: string, selectedNote: Note | null) => {
    console.log('[AI] Processing note actions:', actions);

    for (const action of actions) {
      try {
        if (action.type === 'create') {
          // Create a new note
          const title = action.title || `New Note - ${new Date().toLocaleDateString()}`;
          const content = action.content || '';
          const folderId = action.folderId || null;
          
          const newNote = notesStore.createNote(title, content, folderId);
          
          const createMessage: Message = {
            id: 'ai-created-' + Date.now().toString(),
            isUser: false,
            timestamp: new Date(),
            content: `✅ Created new note: **${newNote.title}**`,
          };
          setMessages((prev) => [...prev, createMessage]);
          
          postLinkMessage(newNote.id, newNote.title);
          continue;
        }

        if (action.type === 'edit') {
          let targetId = action.noteId ?? null;

          if (!targetId && selectedNote) {
            targetId = selectedNote.id;
          }

          if (!targetId) {
            console.log('[AI] No target note resolved for edit action; creating new note instead.');
            const title = action.title || `New Note - ${new Date().toLocaleDateString()}`;
            const content = action.content || '';
            
            const newNote = notesStore.createNote(title, content, null);
            
            const createMessage: Message = {
              id: 'ai-created-' + Date.now().toString(),
              isUser: false,
              timestamp: new Date(),
              content: `✅ Created new note: **${newNote.title}**`,
            };
            setMessages((prev) => [...prev, createMessage]);
            
            postLinkMessage(newNote.id, newNote.title);
            continue;
          }

          const existing = notesStore.findNoteById(targetId);
          const infoEdit: Message = {
            id: 'ai-editing-' + Date.now().toString(),
            isUser: false,
            timestamp: new Date(),
            content: `Editing note ID ${targetId}: <strong>${escapeHtml(existing?.title || 'Untitled')}</strong>`,
          };
          setMessages((prev) => [...prev, infoEdit]);

          const currentContent = existing?.content || '';
          const mode = action.mode || inferEditMode(userText);
          const find = action.find;
          const replaceWith = action.replaceWith;
          let newContent = currentContent;

          if (mode === 'remove') {
            const snippet = (action.content || '').trim();
            if (snippet) {
              const re = new RegExp(escapeRegExp(snippet), 'g');
              newContent = currentContent.replace(re, '').replace(/\n{3,}/g, '\n\n');
            }
          } else if (mode === 'replace') {
            if (find && typeof replaceWith === 'string') {
              try {
                const re = new RegExp(find, 'g');
                newContent = currentContent.replace(re, replaceWith);
              } catch {
                newContent = currentContent.split(find).join(replaceWith);
              }
            } else if ((action.content || '').trim()) {
              newContent = currentContent + '\n' + (action.content || '').trim();
            }
          } else {
            const toAppend = (action.content || '').trim();
            if (toAppend) newContent = currentContent + '\n' + toAppend;
          }

          const updated = notesStore.updateNote(targetId, {
            title: action.title ?? undefined,
            content: newContent,
          });
          if (updated) postLinkMessage(targetId, updated.title);
        }
      } catch (error) {
        console.error('Error processing AI action:', error);
      }
    }
    onNoteUpdate?.();
  };

  function postLinkMessage(noteId: number, title: string) {
    const url = `/dashboard?noteId=${noteId}`;
    const msg: Message = {
      id: 'link-' + Date.now().toString(),
      isUser: false,
      timestamp: new Date(),
      content: `Edited: <a href="${url}" class="text-blue-600 underline">${escapeHtml(title || 'Untitled')}</a>`,
    } as any;
    setMessages((prev) => [...prev, msg]);
  }

  function buildResultSummary(actions: NoteAction[]) {
    const edited = actions.filter(a => a.type === 'edit').length;
    const created = actions.filter(a => a.type === 'create').length;
    const diagrams = actions.filter(a => a.type === 'diagram').length;
    const parts: string[] = [];
    if (edited) parts.push(`${edited} edit${edited>1?'s':''}`);
    if (created) parts.push(`${created} new note${created>1?'s':''}`);
    if (diagrams) parts.push(`${diagrams} diagram${diagrams>1?'s':''}`);
    return `Applied: ${parts.join(', ') || 'no changes'}.`;
  }

  function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] as string));
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Enhanced quick action functions
  const createMathNote = () => {
  sendMessage("Create a new note about mathematical formulas with LaTeX examples including calculus, algebra, and geometry formulas.");
  };

  const createDiagramNote = () => {
    sendMessage("Create a note with Mermaid diagrams showing different types of flowcharts and process diagrams. Use proper Mermaid syntax wrapped in <pre><code class=\"language-mermaid\">...</code></pre> tags.");
  };

  // New function specifically for diagram generation
  const generateDiagram = () => {
    sendMessage("Generate a Mermaid diagram for me. Make sure to wrap it in <pre><code class=\"language-mermaid\">...</code></pre> tags so it renders properly.");
  };

  // Test function to create a note with a working Mermaid diagram
  const testMermaidRendering = () => {
    const testContent = `
      <h2>🧪 New GraphRenderer Test</h2>
      <p>This test shows the new GraphRenderer using Chart.js and D3.js instead of Mermaid:</p>
      
      <h3>1. Simple Flowchart (Should Work)</h3>
      <pre><code class="language-mermaid">graph LR
        A[Start] --> B{Decision?}
        B -->|Yes| C[Do Something]
        B -->|No| D[Do Nothing]
        C --> E[End]
        D --> E</code></pre>
      
      <h3>2. Complex Diagram with Advanced Features (Should Work)</h3>
      <pre><code class="language-mermaid">graph LR
        A[(-2, 0)] -- B((0, -4)) -- C[(2, 0)]
        style B fill:#ccf,stroke:#f66,stroke-width:2px
        subgraph "Parabola: x^2 - 4"
          A
          B
          C
        end</code></pre>
      
      <h3>3. Sequence Diagram (Should Work)</h3>
      <pre><code class="language-mermaid">sequenceDiagram
        participant U as User
        participant S as System
        participant D as Database
        
        U->>S: Request Data
        S->>D: Query Database
        D-->>S: Return Results
        S-->>U: Display Data</code></pre>
      
      <h3>4. Class Diagram (Should Work)</h3>
      <pre><code class="language-mermaid">classDiagram
        class Animal {
          +name: string
          +makeSound()
        }
        class Dog {
          +bark()
        }
        Animal <|-- Dog</code></pre>
      
      <p><strong>Expected Results:</strong></p>
      <ul>
        <li>✅ All diagrams should render as visual charts</li>
        <li>✅ Complex features (subgraphs, styling) should work</li>
        <li>✅ Better performance and reliability than Mermaid</li>
        <li>📊 Professional-looking charts with Chart.js and D3.js</li>
      </ul>
      
      <p><strong>Benefits of the new GraphRenderer:</strong></p>
      <ul>
        <li>🚀 More reliable rendering</li>
        <li>🎨 Better visual quality</li>
        <li>⚡ Faster performance</li>
        <li>🔧 Better error handling</li>
      </ul>
      
      <p><strong>If you see code blocks instead of diagrams:</strong> There's still a rendering issue.</p>
      <p><strong>Debug:</strong> Check the browser console for error messages.</p>
    `;
    
    if (currentNote) {
      console.log('Updating current note with test content');
      notesStore.updateNote(currentNote.id, { content: testContent });
      onNoteUpdate?.();
    } else {
      console.log('Creating new test note');
      notesStore.createNote('GraphRenderer Test', testContent, null);
      onNoteUpdate?.();
    }
  };

  // Function to manually trigger diagram rendering (for debugging)
  const forceDiagramRender = () => {
    console.log('Forcing graph render...');
    // This will trigger a re-render of the current note
    if (currentNote) {
      const currentContent = currentNote.content;
      notesStore.updateNote(currentNote.id, { content: currentContent });
      onNoteUpdate?.();
    }
  };

  // Function to manually refresh diagrams in the current editor
  const refreshCurrentDiagrams = () => {
    console.log('Refreshing graphs in current editor...');
    // Try to call the global refresh function if available
    if (typeof window !== 'undefined' && (window as any).refreshGraphs) {
      (window as any).refreshGraphs();
    } else {
      console.log('Global refresh function not available');
    }
  };

  // Function to create a simple, reliable diagram example
  const createSimpleDiagram = () => {
    const simpleDiagramContent = `
      <h3>Simple, Reliable Diagram Example</h3>
      <p>Here's a simple flowchart that should render reliably:</p>
      <pre><code class="language-mermaid">graph LR
        A[Start] --> B{Decision?}
        B -->|Yes| C[Process]
        B -->|No| D[Skip]
        C --> E[Result]
        D --> E
        E --> F[End]</code></pre>
      
      <p><strong>Tips for reliable diagrams:</strong></p>
      <ul>
        <li>Use simple syntax: <code>graph LR</code> or <code>flowchart TD</code></li>
        <li>Keep nodes simple: <code>A[Label]</code>, <code>B{Decision}</code></li>
        <li>Avoid: <code>subgraph</code>, <code>style</code>, coordinates, complex styling</li>
        <li>Use basic arrows: <code>--></code>, <code>-->|text|</code></li>
      </ul>
    `;
    
    if (currentNote) {
      const currentContent = currentNote.content + '\n' + simpleDiagramContent;
      notesStore.updateNote(currentNote.id, { content: currentContent });
      onNoteUpdate?.();
    } else {
      notesStore.createNote('Simple Diagram Example', simpleDiagramContent, null);
      onNoteUpdate?.();
    }
  };

  // Function to create a complex diagram with proper syntax
  const createComplexDiagram = () => {
    const complexDiagramContent = `
      <h3>Complex Diagram with Proper Syntax</h3>
      <p>Here's a complex diagram that should render with all features:</p>
      <pre><code class="language-mermaid">graph LR
        A[(-2, 0)] -- B((0, -4)) -- C[(2, 0)]
        style B fill:#ccf,stroke:#f66,stroke-width:2px
        subgraph "Parabola: x^2 - 4"
          A
          B
          C
        end</code></pre>
      
      <p><strong>Tips for complex diagrams:</strong></p>
      <ul>
        <li>Use proper spacing: <code>A[(-2, 0)]</code> not <code>A[(-2,0)]</code></li>
        <li>Use proper quotes: <code>subgraph "Title"</code> not <code>subgraph Title</code></li>
        <li>Use proper semicolons: <code>style B fill:#ccf,stroke:#f66,stroke-width:2px;</code></li>
        <li>Ensure proper line breaks and spacing</li>
      </ul>
    `;
    
    if (currentNote) {
      const currentContent = currentNote.content + '\n' + complexDiagramContent;
      notesStore.updateNote(currentNote.id, { content: currentContent });
      onNoteUpdate?.();
    } else {
      notesStore.createNote('Complex Diagram Example', complexDiagramContent, null);
      onNoteUpdate?.();
    }
  };

  const enhanceCurrentNote = () => {
    if (currentNote) {
  sendMessage(`Enhance my current note "${currentNote.title}" by adding proper formatting, LaTeX math where appropriate, and better organization.`);
    }
  };

  const createStudyGuide = () => {
  sendMessage("Create a comprehensive study guide note with headers, bullet points, math formulas, and diagrams for effective learning.");
  };

  const organizeAllNotes = () => {
  sendMessage("Analyze all my notes and suggest how to better organize them with folders and improved titles.");
  };

  // Function to toggle video lesson mode
  function toggleVideoMode() {
    setIsVideoMode(!isVideoMode);
    
    const modeMessage: Message = {
      id: `mode-${Date.now()}`,
      content: isVideoMode 
        ? "📝 Switched to note editing mode. I can now help you edit and create notes."
        : "🎥 Video creation mode activated! Describe what you want me to teach and I'll create a comprehensive video lesson using Manim.",
      isUser: false,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, modeMessage]);
  }

  // Function to create video lesson with Manim
  async function createVideoLesson(topic: string): Promise<void> {
    setIsLoading(true);
    
    try {
      // Update progress message
      const updateProgress = (step: string, description: string) => {
        const progressMessage: Message = {
          id: `video-progress-${Date.now()}`,
          content: `🎬 **Creating Video: "${topic}"**\n\n${step}\n\n${description}`,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev.slice(0, -1), progressMessage]); // Replace last progress message
      };

      // Step 1: AI creates comprehensive video script (30-second segments)
      updateProgress("🎯 Step 1/4: Analyzing topic and creating comprehensive script...", "Breaking down the topic into 30-second educational segments with detailed visual descriptions.");
      const videoScript = await generateVideoScript(topic);
      
      // Step 2: Generate Manim code from script
      updateProgress("💻 Step 2/4: Generating Manim animation code...", "Converting the script into professional Manim Python code with animations, equations, and diagrams.");
      const manimCode = await generateManimCode(videoScript);
      
      // Step 3: Save and render video
      updateProgress("🎥 Step 3/4: Rendering video with Manim...", "Running Manim to generate the actual video file. This may take a few minutes for complex animations.");
      const videoResult = await renderVideo(manimCode, topic);
      
      // Step 4: Save video as a note in the store
      updateProgress("💾 Step 4/4: Saving video to your notes...", "Creating a video note entry in your workspace.");
      const videoNote = notesStore.createVideoNote(
        topic,
        videoResult.video_path,
        null // Save to root folder, or could use currentFolderId if available
      );
      
      // Step 5: Add completion message
      const completionMessage: Message = {
        id: `video-complete-${Date.now()}`,
        content: `✅ **Video Created Successfully!**\n\nYour video "${topic}" has been generated and saved to the repository. The video includes:\n\n${videoScript.sections.map((section, i) => `📹 **Section ${i + 1}**: ${section.title} (${section.duration}s)`).join('\n')}\n\n🎬 **Total Duration**: ${videoScript.totalDuration} seconds\n📁 **File Location**: ${videoResult.video_path}\n\n📝 **Note ID**: ${videoNote.id} - You can find this video in your notes list!\n\n${videoResult.method === 'manim' ? '🎉 **Real Manim video generated!**' : '⚠️ **Placeholder created** - Install Manim for real videos'}`,
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev.slice(0, -1), completionMessage]); // Replace progress message
      
      // Trigger notes refresh if callback is available
      if (onNoteUpdate) {
        onNoteUpdate();
      }
      
    } catch (error) {
      console.error('Video creation failed:', error);
      const errorMessage: Message = {
        id: `video-error-${Date.now()}`,
        content: `❌ **Video Creation Failed**\n\nThere was an error creating the video: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or check the topic description.`,
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev.slice(0, -1), errorMessage]); // Replace progress message
    } finally {
      setIsLoading(false);
    }
  }

  // Generate comprehensive video script using AI
  async function generateVideoScript(topic: string) {
    const model = getModel();
    
    const prompt = `Create a comprehensive educational video script for the topic: "${topic}"

You must break this into exactly 30-second segments. Each segment should be educational, engaging, and buildable with Manim animations.

Please structure your response as a detailed video plan with the following format:

TITLE: [Video Title] (don't include any repetitive phrases from the prompt)

OVERVIEW: [Brief overview of what the video covers]

SECTIONS: [Break the content into 30-second segments - aim for 6-10 sections total]

For each section, provide:
- Section Title: [Clear, descriptive title]
- Duration: 30 seconds
- Content: [What will be explained - be specific about mathematical concepts, formulas, relationships]
- Visuals: [Detailed description of animations, graphs, diagrams, equations that Manim should create]
- Captions: [Key text that should appear on screen]
- Narration: [Exact script for voiceover - educational and clear]

Requirements:
- Focus on mathematical concepts, scientific principles, or educational content
- Each section should build on the previous one logically
- Include specific mathematical formulas where relevant (use LaTeX notation)
- Describe visual elements that can be animated with Manim (graphs, equations, geometric shapes, etc.)
- Make it engaging and educational
- Total video should be 3-5 minutes (6-10 sections)

Example format:
SECTION 1: Introduction to Derivatives
Duration: 30s
Content: Introduce the concept of derivatives as the instantaneous rate of change
Visuals: Graph of f(x) = x² with a tangent line that moves along the curve, showing slope changes
Captions: "Derivative = Instantaneous Rate of Change"
Narration: "Welcome to our lesson on derivatives. A derivative tells us how fast something is changing at any given moment. Watch as this tangent line shows us the slope at different points..."

SECTION 2: The Limit Definition
Duration: 30s
Content: Show the formal limit definition of a derivative
Visuals: Animation of secant lines approaching a tangent line, with the limit formula appearing
Captions: "f'(x) = lim(h→0) [f(x+h) - f(x)]/h"
Narration: "The derivative is defined as the limit of the difference quotient as h approaches zero..."

Continue this format for all sections.`;

    const result = await model.generateContent(prompt);
    const scriptText = result.response.text();
    
    // Parse the AI response into structured data
    const sections = parseVideoScript(scriptText);
    
    return {
      title: topic,
      sections,
      totalDuration: sections.length * 30,
      scriptText
    };
  }

  // Parse AI-generated script into structured format
  function parseVideoScript(scriptText: string) {
    const sections = [];
    const sectionMatches = scriptText.match(/SECTION \d+:[\s\S]*?(?=SECTION \d+:|$)/g);
    
    if (sectionMatches) {
      for (const match of sectionMatches) {
        const titleMatch = match.match(/SECTION \d+: (.+)/);
        const contentMatch = match.match(/Content: (.+)/);
        const visualsMatch = match.match(/Visuals: (.+)/);
        const captionsMatch = match.match(/Captions: (.+)/);
        const narrationMatch = match.match(/Narration: (.+)/);
        
        sections.push({
          title: titleMatch?.[1] || 'Untitled Section',
          content: contentMatch?.[1] || '',
          visuals: visualsMatch?.[1] || '',
          captions: captionsMatch?.[1] || '',
          narration: narrationMatch?.[1] || '',
          duration: 30
        });
      }
    }
    
    return sections;
  }

  // Generate Manim code from video script
  async function generateManimCode(videoScript: any) {
    const model = getModel();
    
    const prompt = `Generate complete, runnable Manim Python code for this video script:

Title: ${videoScript.title}
Total Duration: ${videoScript.totalDuration} seconds
Number of Sections: ${videoScript.sections.length}

Sections:
${videoScript.sections.map((section: any, i: number) => `
SECTION ${i + 1}: ${section.title}
Content: ${section.content}
Visuals: ${section.visuals}
Captions: ${section.captions}
Narration: ${section.narration}
`).join('\n')}

Requirements:
1. Create a complete Python file with proper Manim imports
2. Use a single Scene class that implements all sections
3. Include smooth transitions between sections (use self.wait() appropriately)
4. Create all mathematical equations using MathTex
5. Include graphs, charts, and diagrams as described in the visuals
6. Add text captions and titles using Text() objects
7. Use colors and animations to make it engaging
8. Follow Manim best practices and syntax
9. Each section should run for approximately 30 seconds
10. Include proper scene cleanup between sections
11. IMPORTANT: when one piece of text appears, it should disappear before the next piece comes or should not overlap it if both are to be on the screen at the same time. also make sure that text doesn't overlap graphs, diagrams, or equations AT ALL. if both are on the screen at the same time, move the text to an appropriate position so that it's completely unoverlapped by any other elements. ALSO MAKE SURE EVERYTHING IS CONTAINED WITHIN THE VIDEO'S DIMENSIONS
The code should be complete and runnable with: manim -pql filename.py SceneName

Template structure:
\`\`\`python
from manim import *
import numpy as np

class ${videoScript.title.replace(/[^a-zA-Z0-9]/g, '')}Video(Scene):
    def construct(self):
        # Title screen
        title = Text("${videoScript.title}", font_size=48, color=BLUE)
        self.play(Write(title))
        self.wait(2)
        self.play(FadeOut(title))
        
        # Section 1: [Implementation based on script]
        # Example of correct syntax:
        # axes = Axes(x_range=[-3, 3], y_range=[-2, 2])
        # func = axes.plot(lambda x: x**2, color=BLUE)
        # tracker = ValueTracker(1)
        # dot = Dot().add_updater(lambda m: m.move_to(axes.c2p(tracker.get_value(), tracker.get_value()**2)))
        # self.play(Create(axes), Create(func))
        # self.play(tracker.animate.set_value(2), run_time=3)
        
        # Section 2: [Implementation based on script]
        # ... continue for all sections
        
        # End screen
        end_text = Text("Thank you for watching!", font_size=36)
        self.play(Write(end_text))
        self.wait(3)
\`\`\`

WORKING ANIMATION EXAMPLES:
1. Moving a dot along a curve:
   tracker = ValueTracker(0)
   dot = Dot()
   dot.add_updater(lambda m: m.move_to(axes.c2p(tracker.get_value(), np.sin(tracker.get_value()))))
   self.play(tracker.animate.set_value(TAU), run_time=4)

2. Animating function parameters:
   a_tracker = ValueTracker(1)
   func = always_redraw(lambda: axes.plot(lambda x: a_tracker.get_value() * x**2, color=BLUE))
   self.play(a_tracker.animate.set_value(3), run_time=2)

3. Moving objects:
   circle = Circle()
   self.play(circle.animate.move_to(RIGHT * 2))

Generate the complete implementation for each section based on the provided script. Use appropriate Manim objects:
- Text() for titles and captions
- MathTex() for mathematical formulas  
- Axes() and plot functions for coordinate systems and graphs
- Circle(), Rectangle(), Polygon() for shapes
- NumberLine() for number representations
- Transform(), Write(), FadeIn(), FadeOut() for animations
- Line(), Arrow(), Dot() for basic geometric elements
- VGroup() to group multiple objects together

IMPORTANT: NEVER use external files! Create all visuals using Manim's built-in objects:
- Instead of ImageMobject("file.png"), use Circle(), Rectangle(), Polygon(), or other built-in shapes
- Instead of SVGMobject("file.svg"), use combinations of built-in geometric objects
- All visuals must be created using only Manim's primitive objects and mathematical functions
- You can combine multiple simple shapes to create complex diagrams
- Use colors, fills, and positioning to make shapes representative of the concepts

IMPORTANT: MAKE SURE ALL ELEMENTS AND TEXT IN TEH VIDEO ARE CONTAINED WITHIN IT'S DIMENSIONS. IT IS IMPERATIVE TO NOT HAVE TEXT OR DIAGRAMS OVERFLOWING BEYOND THE EDGES OF THE VIDEO.
IMPORTANT: MAKE STUFF DISAPPEAR BEFORE PUTTING NEW STUFF. DON'T PLACE GRAPHS AND DIAGRAMS AND NUMBERS ON TOP OF EACH OTHER AT THE SAME TIME. AFTER ONE HAS BEEN USED, MAKE IT DISAPPEAR AND MAKE THEM APPEAR ONE BY ONE, NOT ALL AT ONCE.

CRITICAL MANIM SYNTAX RULES (Community v0.19.0):
- For plotting functions, use: axes.plot(lambda x: np.sin(x), x_range=[-3, 3], color=BLUE)
- For parametric plots, use: ParametricFunction(lambda t: [t, np.sin(t), 0], t_range=[-3, 3])
- DO NOT use Graph() class with x_range parameter - this is incorrect syntax
- For unit circles and trig functions, use Circle() and plot() methods
- For animating values, use ValueTracker: tracker = ValueTracker(0), then tracker.animate.set_value(3)
- DO NOT try to animate plain numbers or integers - they have no animate attribute
- For moving objects, use: obj.animate.move_to(point) or obj.animate.shift(vector)
- For transforming objects, use: Transform(obj1, obj2) or ReplacementTransform(obj1, obj2)
- Always create Manim objects (ValueTracker, Dot, Line, etc.) before trying to animate them
- Always use proper Manim Community v0.19.0 syntax
- For LaTeX strings, ALWAYS use r-strings: MathTex(r"\\sin(x)") not MathTex("\\sin(x)")
- VALID positioning methods: .to_edge(UP), .to_corner(UL), .next_to(obj, RIGHT), .move_to(ORIGIN), .shift(UP)
- INVALID methods: .to_center(), .move_along_path(), .center() - these don't exist

FORBIDDEN CODE PATTERNS - NEVER WRITE THESE:
❌ a = 2; a.animate.set_value(3)  # WRONG: 'a' is integer, not ValueTracker
❌ h_val = 1; h_val.animate.set_value(0.5)  # WRONG: 'h_val' is integer, not ValueTracker  
❌ x_val = 1; x_val.animate.set_value(2)  # WRONG: 'x_val' is integer, not ValueTracker
❌ ImageMobject("any_file.png")  # WRONG: External image files don't exist
❌ SVGMobject("any_file.svg")  # WRONG: External SVG files don't exist
❌ ImageMobject("rutherford_experiment.png")  # WRONG: Image files are not available
❌ dot.animate.move_along_path(circle)  # WRONG: move_along_path doesn't exist
❌ obj.to_center()  # WRONG: to_center doesn't exist, use .move_to(ORIGIN)
❌ MathTex("y = \\sin(x)")  # WRONG: Single backslash causes escape sequence error
❌ MathTex("\\pi")  # WRONG: Single backslash causes escape sequence error

CORRECT CODE PATTERNS - ALWAYS USE THESE:
✅ a_tracker = ValueTracker(2); a_tracker.animate.set_value(3)  # CORRECT
✅ h_tracker = ValueTracker(1); h_tracker.animate.set_value(0.5)  # CORRECT
✅ x_tracker = ValueTracker(1); x_tracker.animate.set_value(2)  # CORRECT
✅ Circle(radius=0.5, color=RED, fill_opacity=1)  # CORRECT: Use built-in shapes
✅ Rectangle(width=2, height=1, color=BLUE)  # CORRECT: Use built-in shapes
✅ Polygon([0,0,0], [1,0,0], [0.5,1,0], color=GREEN)  # CORRECT: Use built-in shapes
✅ obj.animate.move_to(ORIGIN)  # CORRECT: Use move_to for positioning
✅ obj.animate.shift(RIGHT*2)  # CORRECT: Use shift for relative movement
✅ MathTex(r"y = \\sin(x)")  # CORRECT: Use r-string for LaTeX with double backslash
✅ MathTex(r"\\pi")  # CORRECT: Use r-string for LaTeX symbols
✅ MathTex(r"\\frac{1}{2}")  # CORRECT: Use r-string for LaTeX fractions

If you need to animate a changing value, ALWAYS use ValueTracker, never plain numbers.

Make sure ALL code is syntactically correct and follows current Manim conventions.

SUMMARY:
You'll receive a complete script. Your job is to generate fully functional Manim (Python) code that mirrors every line of that script—verbatim—using on-screen text and visuals. Follow these rules exactly:

1. **Exact text only.** Every word of the script that appears on screen must match character for character. No paraphrasing or editing. make sure that stuff is not overlayed on top of other stuff. 
IMPORTANT: when one piece of text appears, it should disappear before the next piece comes or should not overlap it if both are to be on the screen at the same time. also make sure that text doesn't overlap graphs, diagrams, or equations AT ALL. if both are on the screen at the same time, move the text to an appropriate position so that it's completely unoverlapped by any other elements. ALSO MAKE SURE EVERYTHING IS CONTAINED WITHIN THE VIDEO'S DIMENSIONS
2. **Visualize only what's described.** Whenever the script mentions a shape, graph, mathematical object, or concept, show a matching Manim primitive (e.g., Circle(), Line(), NumberPlane()); if it doesn't, simply display the script text with Text() or Tex(). 
3. **No added assumptions.** If something is ambiguous or unspecified, skip inventing visuals—just render the original text.
4. **Well-structured, runnable code.** Provide a single Python file with all imports ('from manim import *'), a Scene subclass, and clear comments tying each code block to its script lines. It must run without errors in a standard ManimCE setup.
5. **Timing and layout.** Honor any timestamps with 'wait()', keep text legible for a 16:9 video, and space objects to avoid overlap.
6. **No extras.** Do not include commentary, reasoning, or any content not explicitly in the script.
7. Make sure that all text and graphics are completely visible in the video area.
8. Add visuals wherever possible to illustrate the concepts in the script, but do not add any extra content that is not in the script. Make sure these visuals are appropriately positioned and sized for clarity.
9. **NO EXTERNAL FILES**: Never use ImageMobject(), SVGMobject(), or any file loading functions. Create all visuals using only Manim's built-in geometric objects (Circle, Rectangle, Polygon, Line, Arrow, Dot, etc.). Combine simple shapes to create complex diagrams.
10. **Precise timing control:** When timestamps appear in the script (like "[0:08]"), implement precise scene transitions. At each timestamp:
   a. Clear previous elements with appropriate FadeOut animations
   b. Introduce new content with suitable animations (Write, FadeIn, etc.)
   c. Use wait() calls to maintain exact timing between timestamps
   d. Ensure smooth transitions between sections while strictly adhering to the timestamp progression
   e. For mathematical concepts introduced at specific timestamps, time their appearance to match exactly when mentioned
11. The video should be finished when the final timestamp is reached, with all elements cleared.
Your output should be a complete, clean, executable Manim script that faithfully and exactly represents the input, with just enough visuals to illustrate what the script names.

****** IMPORTANT *******
# instead of
curve = plane.get_graph(curve_func, t_range=[-4.5, 4.5], color=YELLOW, stroke_width=4)

# do this:
curve = plane.plot(
    curve_func,
    x_range=[-4.5, 4.5],
    color=YELLOW,
    stroke_width=4
)

CRITICAL LaTeX FORMATTING RULES:
- ALWAYS use r-strings for LaTeX: MathTex(r"\\sin(x)") NOT MathTex("\\sin(x)")
- Double backslashes in r-strings: r"\\pi", r"\\sin", r"\\cos", r"\\frac{1}{2}"
- Common LaTeX symbols: r"\\pi", r"\\theta", r"\\alpha", r"\\beta", r"\\infty"
- Fractions: r"\\frac{numerator}{denominator}"
- Subscripts: r"x_1", r"a_n"
- Superscripts: r"x^2", r"e^{\\pi i}"
- Functions: r"\\sin(x)", r"\\cos(\\theta)", r"\\tan(\\alpha)"

EXAMPLE CORRECT LaTeX:
- MathTex(r"y = \\sin(x)")
- MathTex(r"\\frac{d}{dx}[\\sin(x)] = \\cos(x)")
- MathTex(r"\\pi \\approx 3.14159")
- MathTex(r"e^{i\\pi} + 1 = 0")

IMPORTANT: Provide ONLY the complete Python code with no explanations, comments outside the code, or markdown formatting. Just the raw Python code that can be directly saved to a file and executed.
`;

    const result = await model.generateContent(prompt);
    let manimCode = result.response.text();
    
    // Clean up the code if it has markdown formatting
    if (manimCode.includes('```python')) {
      const codeMatch = manimCode.match(/```python\n([\s\S]*?)\n```/);
      if (codeMatch) {
        manimCode = codeMatch[1];
      }
    } else if (manimCode.includes('```')) {
      const codeMatch = manimCode.match(/```\n([\s\S]*?)\n```/);
      if (codeMatch) {
        manimCode = codeMatch[1];
      }
    }
    
    return manimCode;
  }

  // Render video using Manim backend service
  async function renderVideo(manimCode: string, topic: string) {
    const fileName = topic.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Call backend to render video
    const response = await fetch('http://localhost:5001/api/render-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manimCode,
        fileName,
        topic
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to render video');
    }
    
    const result = await response.json();
    return result;
  }

  // Render message content with HTML support
  const renderMessageContent = (content: string) => {
    return (
      <div 
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ 
          __html: content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
            .replace(/###\s(.*?)(?=<br>|$)/g, '<h3 class="text-lg font-semibold mt-3 mb-2">$1</h3>')
            .replace(/##\s(.*?)(?=<br>|$)/g, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
            .replace(/#\s(.*?)(?=<br>|$)/g, '<h1 class="text-2xl font-bold mt-4 mb-3">$1</h1>')
            .replace(/•\s/g, '• ')
        }}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-lg border-l border-gray-200 z-40 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">🤖 Advanced AI Assistant</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1">Full note management & LaTeX support</p>
      </div>

      {/* File Selector */}
      <div className="p-4 border-b border-gray-200">
        <FileSelector onSelect={handleFileSelection} />
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-gray-100 bg-gray-50">
        <div className="text-xs text-gray-600 mb-2">Quick Actions:</div>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={createMathNote}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            📐 Math Note
          </button>
          <button
            onClick={createDiagramNote}
            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
          >
            📊 Diagrams
          </button>
          <button
            onClick={generateDiagram}
            className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
          >
            🎨 Generate Diagram
          </button>
          <button
            onClick={enhanceCurrentNote}
            disabled={!currentNote}
            className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✨ Enhance
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 mt-1">
          <button
            onClick={createStudyGuide}
            className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
          >
            📚 Study Guide
          </button>
          <button
            onClick={organizeAllNotes}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            🗂️ Organize All Notes
          </button>
        </div>
        <button
          onClick={testMermaidRendering}
          className="w-full mt-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          🧪 Test New GraphRenderer
        </button>
        <button
          onClick={forceDiagramRender}
          className="w-full mt-1 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
        >
          🔄 Force Graph Render
        </button>
        <button
          onClick={refreshCurrentDiagrams}
          className="w-full mt-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          🔄 Refresh Current Graphs
        </button>
        <button
          onClick={createSimpleDiagram}
          className="w-full mt-1 text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
        >
          🎨 Create Simple Diagram
        </button>
        <button
          onClick={createComplexDiagram}
          className="w-full mt-1 text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
        >
          🎨 Create Complex Diagram
        </button>
        {/* Video Lesson Mode Toggle button */}
        <button
          onClick={toggleVideoMode}
          className={`w-full mt-1 text-xs px-2 py-1 rounded transition-colors ${
            isVideoMode 
              ? 'bg-teal-500 text-white shadow-md' 
              : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
          }`}
        >
          🎥 {isVideoMode ? 'Video Mode Active' : 'Create Video Lesson'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${
              message.isUser 
                ? 'ml-8 bg-blue-500 text-white rounded-l-lg rounded-tr-lg' 
                : 'mr-8 bg-gray-100 text-gray-800 rounded-r-lg rounded-tl-lg'
            } p-3 shadow-sm`}
          >
            {message.isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              renderMessageContent(message.content)
            )}
            <div className={`text-xs mt-2 ${message.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="mr-8 bg-gray-100 text-gray-800 rounded-r-lg rounded-tl-lg p-3">
            <div className="typing-indicator">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2 mb-2">
          <button
            onClick={clearChat}
            className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 border rounded"
          >
            Clear
          </button>
        </div>
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to create, edit, or enhance notes with LaTeX, diagrams, and rich formatting..."
            className="flex-1 p-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
