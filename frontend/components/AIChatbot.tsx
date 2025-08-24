"use client";

import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { notesStore, type Note } from '@/lib/notesStore';

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
  // diagram-specific
  target?: 'new' | 'append';
  diagram?: string;
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
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || 'AIzaSyB5mlVHMkZAA11UTe8lHGE2WSxeb4AfSPU';
    const ai = new GoogleGenerativeAI(apiKey);
    return ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  // Prompt engineering: return structured JSON actions only
  function buildSystemInstruction() {
    const notesContext = allNotesSnapshot.map(n => ({ id: n.id, title: n.title, folder_id: n.folder_id, content: n.content })).slice(0, 50);
    return `You are an AI note assistant with full write access. You MUST return only JSON matching this schema in your response, no prose:
{
  "actions": [
    {"type":"create","title":string,"content":string,"folderId": number|null},
    {"type":"edit","noteId":number,"title?":string,"content":string},
    {"type":"format","noteId":number,"content":string},
    {"type":"diagram","target":"new|append","noteId?":number,"title?":string,"diagram": string}
  ]
}

Rules:
- Use HTML for headings/lists/formatting with inline CSS as desired (font-size, color, bold/italic, etc.).
- For math, embed LaTeX between $$ ... $$ blocks anywhere in the HTML.
- For diagrams:
  • Flow/process/sequence/class → use Mermaid, wrapped in <pre><code class="language-mermaid">...</code></pre>.
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
    smiles: C1=CC=CC=C1
  Ensure one diagram per code block and correct language class.
- Keep content readable and self-contained. No outer <html> or <body> tags.
- When user asks to edit the current note, produce an 'edit' action editing that noteId.
- Prefer editing the currently selected note (id: ${currentNote?.id ?? 'null'}) when appropriate.
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
      let actions = await callAI(userMessage.content);

      // Fallback: if no actions parsed, synthesize an edit using HTML content
  if (!actions.length) {
        console.log('No AI actions parsed, using fallback content generation');
        const targetNoteId = pickTargetNoteId(userMessage.content);
        console.log('Target note ID:', targetNoteId);
        const contentHtml = await callAIForContent(userMessage.content, targetNoteId);
        console.log('Generated fallback content:', contentHtml);
        if (targetNoteId && contentHtml) {
          // Check if the user is asking for diagrams and ensure proper formatting
          const isDiagramRequest = /diagram|graph|chart|flowchart|visual/i.test(userMessage.content);
          console.log('Is diagram request:', isDiagramRequest);
          let finalContent = contentHtml;
          
          if (isDiagramRequest) {
            // Ensure Mermaid code is properly wrapped
            // Look for lines starting with graph, flowchart, etc. and wrap them
            finalContent = contentHtml.replace(
              /(graph\s+[A-Z]{2}[\s\S]*?)(?=\n\n|$)/gi,
              '<pre><code class="language-mermaid">$1</code></pre>'
            );
            
            // Also look for any other Mermaid syntax patterns
            finalContent = finalContent.replace(
              /(flowchart\s+[A-Z]{2}[\s\S]*?)(?=\n\n|$)/gi,
              '<pre><code class="language-mermaid">$1</code></pre>'
            );
            
            finalContent = finalContent.replace(
              /(sequenceDiagram[\s\S]*?)(?=\n\n|$)/gi,
              '<pre><code class="language-mermaid">$1</code></pre>'
            );
            
            finalContent = finalContent.replace(
              /(classDiagram[\s\S]*?)(?=\n\n|$)/gi,
              '<pre><code class="language-mermaid">$1</code></pre>'
            );

            // Plot/Math blocks
            finalContent = finalContent.replace(
              /(plot[\s\S]*?)(?=\n\n|$)/gi,
              '<pre><code class="language-plot">$1</code></pre>'
            );
            finalContent = finalContent.replace(
              /(math[\s\S]*?)(?=\n\n|$)/gi,
              '<pre><code class="language-plot">$1</code></pre>'
            );

            // Chemistry blocks
            finalContent = finalContent.replace(
              /((?:chem|smiles)[\s\S]*?)(?=\n\n|$)/gi,
              '<pre><code class="language-chem">$1</code></pre>'
            );

            // Vector blocks
            finalContent = finalContent.replace(
              /(vector[\s\S]*?)(?=\n\n|$)/gi,
              '<pre><code class="language-vector">$1</code></pre>'
            );
            
            // If no diagrams were found, add a simple one
            if (!finalContent.includes('language-mermaid')) {
              console.log('No diagrams found in content, adding simple diagram');
              const simpleDiagram = `
                <h3>Generated Diagram</h3>
                <p>Here's a simple flowchart based on your request:</p>
                <pre><code class="language-mermaid">graph LR
                  A[Start] --> B{Process?}
                  B -->|Yes| C[Continue]
                  B -->|No| D[Stop]
                  C --> E[End]
                  D --> E</code></pre>
                <h3>Generated Plot</h3>
                <pre><code class="language-plot">plot
f(x) = sin(x)
g(x) = x^2 - 4
domain: -6.28..6.28</code></pre>
                <h3>Generated Vector</h3>
                <pre><code class="language-vector">vector
axes: -10..10 x -10..10
vec (0,0) -> (3,4) label: v</code></pre>
              `;
              finalContent = contentHtml + simpleDiagram;
            }
            
            // Also simplify any complex diagrams that might fail
            finalContent = finalContent.replace(
              /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
              (match, diagramCode) => {
                // First try to fix syntax while preserving complex features
                let fixedSyntax = diagramCode
                  // Fix coordinate syntax - ensure proper spacing
                  .replace(/\[\(([^)]+)\)/g, '[$1]')
                  // Fix style commands - ensure proper semicolon placement
                  .replace(/style\s+(\w+)\s+([^;]+);/g, 'style $1 $2;')
                  // Fix subgraph syntax - ensure proper quotes and spacing
                  .replace(/subgraph\s+["']([^"']*)["']\s*\n/g, 'subgraph "$1"\n')
                  // Fix arrow syntax - ensure proper spacing
                  .replace(/(\w+)\s*--\s*(\w+)/g, '$1 -- $2')
                  // Fix node definitions - ensure proper spacing
                  .replace(/(\w+)\[([^\]]+)\]/g, '$1[$2]')
                  // Clean up extra whitespace
                  .replace(/\n\s*\n/g, '\n')
                  .trim();
                
                console.log('Fixed complex diagram syntax from:', diagramCode.substring(0, 100));
                console.log('To:', fixedSyntax.substring(0, 100));
                
                return `<pre><code class="language-mermaid">${fixedSyntax}</code></pre>`;
              }
            );
            
            console.log('Final content after diagram processing:', finalContent);
          }
          
          actions = [{ type: 'edit', noteId: targetNoteId, content: finalContent } as NoteAction];
          console.log('Created fallback action:', actions[0]);
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: actions.length ? 'Applied your requested changes to notes.' : 'No actionable changes detected.',
        isUser: false,
        timestamp: new Date(),
        actions,
      };
      setMessages((prev) => [...prev, aiMessage]);
      if (actions.length) {
        console.log('AI Actions:', actions);
        await processNoteActions(actions);
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

  // Try to select a target note based on current selection or fuzzy title match in user text
  function pickTargetNoteId(userText: string): number | null {
    if (currentNote?.id) return currentNote.id;
    const text = userText.toLowerCase();
    // Simple title match against all notes
    let best: Note | undefined;
    for (const n of allNotesSnapshot) {
      const t = (n.title || '').toLowerCase();
      if (t && (text.includes(t) || t.includes('limit') && text.includes('limit'))) {
        best = n; break;
      }
    }
    return best?.id ?? (allNotesSnapshot[0]?.id ?? null);
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
- For diagrams, ALWAYS use Mermaid syntax wrapped in <pre><code class="language-mermaid">...</code></pre> tags.
- Use SIMPLE Mermaid syntax that will render reliably.
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
  const processNoteActions = async (actions: NoteAction[]) => {
    console.log('Processing note actions:', actions);
    for (const action of actions) {
      try {
        if (action.type === 'create') {
          console.log('Creating note with content:', action.content);
          const destFolder = (action as any).folderId ?? currentNote?.folder_id ?? null;
          notesStore.createNote(action.title || 'Untitled', action.content || '', destFolder);
        } else if (action.type === 'edit' && action.noteId) {
          console.log('Editing note with content:', action.content);
          notesStore.updateNote(action.noteId, {
            title: action.title ?? undefined,
            content: action.content || '',
          });
        } else if (action.type === 'format' && action.noteId) {
          console.log('Formatting note with content:', action.content);
          notesStore.updateNote(action.noteId, { content: action.content || '' });
        } else if (action.type === 'diagram') {
          console.log('Processing diagram action:', action);
          const raw = (action.diagram || '').trim();
          const looksSvg = /^<svg[\s>]/i.test(raw) || /^svg\b/i.test(raw);
          const looksChem = /^(chem|smiles)\b/i.test(raw);
          const looksPlot = /^(plot|math)\b/i.test(raw);
          const looksVector = /^vector\b/i.test(raw);
          const looksMermaid = /^(graph|flowchart|sequenceDiagram|classDiagram)\b/i.test(raw);
          let wrapped = raw;
          if (!/class="language-/.test(raw)) {
            if (looksSvg) wrapped = `<pre><code class="language-svg">${raw}</code></pre>`;
            else if (looksChem) wrapped = `<pre><code class="language-chem">${raw}</code></pre>`;
            else if (looksPlot) wrapped = `<pre><code class="language-plot">${raw}</code></pre>`;
            else if (looksVector) wrapped = `<pre><code class="language-vector">${raw}</code></pre>`;
            else if (looksMermaid) wrapped = `<pre><code class="language-mermaid">${raw}</code></pre>`;
            else wrapped = `<pre><code class="language-mermaid">graph LR\nA[Start] --> B[End]</code></pre>`;
          }
          if (action.target === 'new') {
            const diagramContent = wrapped;
            console.log('Creating new diagram note with content:', diagramContent);
            notesStore.createNote(action.title || 'Diagram', diagramContent, null);
          } else if (action.noteId) {
            const n = notesStore.findNoteById(action.noteId);
            const appended = (n?.content || '') + `\n${wrapped}`;
            console.log('Appending diagram to note with content:', appended);
            notesStore.updateNote(action.noteId, { content: appended });
          }
        }
      } catch (error) {
        console.error('Error processing AI action:', error);
      }
    }
    onNoteUpdate?.();
  };

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
