'use client';

import { useState, useEffect, useRef } from 'react';
import { notesStore } from '@/lib/notesStore';
import 'katex/dist/katex.min.css';
import GraphRenderer from './GraphRenderer';
import ReactDOM from 'react-dom/client';

interface Note {
  id: number;
  title: string;
  content: string;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
  type?: 'note' | 'video';
  video_path?: string;
}

interface RichTextEditorProps {
  note: Note | null;
  onSave: (content: string) => void;
}

export default function RichTextEditor({ note, onSave }: RichTextEditorProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [showMathModal, setShowMathModal] = useState(false);
  const [mathExpression, setMathExpression] = useState('');
  const [savedCursorPosition, setSavedCursorPosition] = useState<Range | null>(null);
  const [currentFormat, setCurrentFormat] = useState({
    bold: false,
    italic: false,
    underline: false,
    fontSize: '14',
    fontColor: '#000000',
    backgroundColor: '#ffffff'
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Enhanced drawing state
  const [drawingHistory, setDrawingHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [drawingTool, setDrawingTool] = useState<'pen' | 'eraser'>('pen');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [editingDrawingIndex, setEditingDrawingIndex] = useState<number | null>(null);
  const [savedDrawings, setSavedDrawings] = useState<string[]>([]);

  // Lazy-loaded libs
  const vizRef = useRef<any>(null);
  const DOMPurifyRef = useRef<any>(null);
  const isRenderingRef = useRef(false);
  const renderTimerRef = useRef<number | null>(null);

  // Helpers
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');

  // Minimal Markdown normalization for images and links that AI might output
  const normalizeBasicMarkdown = (input: string) => {
    if (!input) return input;
    let out = input;
    // Images: ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)/g, (_m, alt, url, title) => {
      const a = String(alt || '').replace(/\"/g, '&quot;');
      const u = String(url || '').replace(/\"/g, '&quot;');
      const t = title ? ` title=\"${String(title).replace(/\"/g, '&quot;')}\"` : '';
      return `<img src="${u}" alt="${a}"${t} loading="lazy" referrerpolicy="no-referrer"/>`;
    });
    // Links: [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)/g, (_m, text, url, title) => {
      const t = String(text || '');
      const u = String(url || '').replace(/\"/g, '&quot;');
      const ti = title ? ` title=\"${String(title).replace(/\"/g, '&quot;')}\"` : '';
      return `<a href="${u}" target="_blank" rel="noopener noreferrer"${ti}>${t}</a>`;
    });
    return out;
  };

  const normalizeCodeFences = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    // Common mermaid starters
    const mermaidStart = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)\b/i;
  // 1) Labeled fences: ```mermaid|dot|graphviz|plot|math|chem|vector|svg
  let replaced = html.replace(/```(mermaid|dot|graphviz|plot|math|chem|vector|svg)\n([\s\S]*?)```/gi, (_m, lang, code) => {
      const language = String(lang).toLowerCase();
      const cls = language === 'graphviz' ? 'language-graphviz' : `language-${language}`;
      return `<pre><code class="${cls}">${escapeHtml(String(code))}</code></pre>`;
    });
    // Also support tildes fences ~~~lang
  replaced = replaced.replace(/~~~(mermaid|dot|graphviz|plot|math|chem|vector|svg)\n([\s\S]*?)~~~/gi, (_m, lang, code) => {
      const language = String(lang).toLowerCase();
      const cls = language === 'graphviz' ? 'language-graphviz' : `language-${language}`;
      return `<pre><code class="${cls}">${escapeHtml(String(code))}</code></pre>`;
    });
    // 2) Unlabeled fences that contain mermaid syntax: ```\ngraph ...```
    replaced = replaced.replace(/```\s*\n([\s\S]*?)```/g, (_m, code) => {
      const body = String(code).trimStart();
      if (mermaidStart.test(body)) {
        return `<pre><code class="language-mermaid">${escapeHtml(String(code))}</code></pre>`;
      }
      // New simple types
      if (/^(plot|math)\b/i.test(body)) {
        return `<pre><code class="language-math">${escapeHtml(String(code))}</code></pre>`;
      }
  if (/^(chem)\b/i.test(body)) {
        return `<pre><code class="language-chem">${escapeHtml(String(code))}</code></pre>`;
      }
      if (/^vector\b/i.test(body)) {
        return `<pre><code class="language-vector">${escapeHtml(String(code))}</code></pre>`;
      }
      if (/^svg\b/i.test(body) || /<svg[\s>]/i.test(body)) {
        return `<pre><code class="language-svg">${escapeHtml(String(code))}</code></pre>`;
      }
      // Try to detect DOT/Graphviz with keywords graph/digraph
      if (/^(graph|digraph)\s+/i.test(body)) {
        return `<pre><code class="language-dot">${escapeHtml(String(code))}</code></pre>`;
      }
      return _m; // leave as-is
    });
    // Also support unlabeled tildes fences ~~~\n...
    replaced = replaced.replace(/~~~\s*\n([\s\S]*?)~~~/g, (_m, code) => {
      const body = String(code).trimStart();
      if (mermaidStart.test(body)) {
        return `<pre><code class="language-mermaid">${escapeHtml(String(code))}</code></pre>`;
      }
      if (/^(plot|math)\b/i.test(body)) {
        return `<pre><code class="language-math">${escapeHtml(String(code))}</code></pre>`;
      }
  if (/^(chem)\b/i.test(body)) {
        return `<pre><code class="language-chem">${escapeHtml(String(code))}</code></pre>`;
      }
      if (/^vector\b/i.test(body)) {
        return `<pre><code class="language-vector">${escapeHtml(String(code))}</code></pre>`;
      }
      if (/^svg\b/i.test(body) || /<svg[\s>]/i.test(body)) {
        return `<pre><code class="language-svg">${escapeHtml(String(code))}</code></pre>`;
      }
      if (/^(graph|digraph)\s+/i.test(body)) {
        return `<pre><code class="language-dot">${escapeHtml(String(code))}</code></pre>`;
      }
      return _m;
    });
    if (replaced !== html) {
      editorRef.current.innerHTML = replaced;
    }
  };

  // Wrap bare Mermaid code (e.g., lines starting with "graph LR" or "flowchart TB") into <pre><code class="language-mermaid">
  const wrapBareMermaidBlocks = () => {
    const root = editorRef.current;
    if (!root) return;
    const mermaidStart = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)\b/i;
    // Candidates: paragraphs, divs, list items, blockquotes, and pre without code class
    const candidates = root.querySelectorAll('p, div, li, blockquote, pre');
    const toReplace: Array<{ el: HTMLElement; code: string }> = [];
    candidates.forEach((el) => {
      const element = el as HTMLElement;
      if (element.closest('pre code')) return; // already inside code
      if (element.classList.contains('mermaid')) return; // handled elsewhere
      const text = (element.innerText || '').replace(/\u00a0/g, ' ').trimStart();
      if (!text) return;
      if (mermaidStart.test(text)) {
        toReplace.push({ el: element, code: text });
      }
    });
    for (const { el, code } of toReplace) {
      const pre = document.createElement('pre');
      const codeEl = document.createElement('code');
      codeEl.className = 'language-mermaid';
      codeEl.textContent = code;
      pre.appendChild(codeEl);
      el.replaceWith(pre);
    }
    // Also, if there's <pre><code> without a language but containing mermaid syntax, tag it
    const plainCodes = root.querySelectorAll('pre > code:not([class])');
    plainCodes.forEach((codeEl) => {
      const text = (codeEl.textContent || '').trimStart();
      if (mermaidStart.test(text)) {
        (codeEl as HTMLElement).className = 'language-mermaid';
      } else if (/^(plot|math)\b/i.test(text)) {
        (codeEl as HTMLElement).className = 'language-math';
  } else if (/^(chem)\b/i.test(text)) {
        (codeEl as HTMLElement).className = 'language-chem';
      } else if (/^vector\b/i.test(text)) {
        (codeEl as HTMLElement).className = 'language-vector';
      } else if (/^svg\b/i.test(text) || /<svg[\s>]/i.test(text)) {
        (codeEl as HTMLElement).className = 'language-svg';
      } else if (/^(graph|digraph)\s+/i.test(text)) {
        (codeEl as HTMLElement).className = 'language-dot';
      }
    });
    // Finally, convert top-level text nodes starting with mermaid syntax
    const topLevelNodes = Array.from(root.childNodes);
    topLevelNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const raw = (node.textContent || '').replace(/\u00a0/g, ' ');
        const trimmed = raw.trimStart();
        if (mermaidStart.test(trimmed)) {
          const pre = document.createElement('pre');
          const codeEl = document.createElement('code');
          codeEl.className = 'language-mermaid';
          codeEl.textContent = raw; // preserve original spacing/newlines
          pre.appendChild(codeEl);
          node.parentNode?.replaceChild(pre, node);
        } else if (/^(plot|math)\b/i.test(trimmed)) {
          const pre = document.createElement('pre');
          const codeEl = document.createElement('code');
          codeEl.className = 'language-math';
          codeEl.textContent = raw;
          pre.appendChild(codeEl);
          node.parentNode?.replaceChild(pre, node);
    } else if (/^(chem)\b/i.test(trimmed)) {
          const pre = document.createElement('pre');
          const codeEl = document.createElement('code');
          codeEl.className = 'language-chem';
          codeEl.textContent = raw;
          pre.appendChild(codeEl);
          node.parentNode?.replaceChild(pre, node);
        } else if (/^vector\b/i.test(trimmed)) {
          const pre = document.createElement('pre');
          const codeEl = document.createElement('code');
          codeEl.className = 'language-vector';
          codeEl.textContent = raw;
          pre.appendChild(codeEl);
          node.parentNode?.replaceChild(pre, node);
        } else if (/^svg\b/i.test(trimmed) || /<svg[\s>]/i.test(trimmed)) {
          const pre = document.createElement('pre');
          const codeEl = document.createElement('code');
          codeEl.className = 'language-svg';
          codeEl.textContent = raw;
          pre.appendChild(codeEl);
          node.parentNode?.replaceChild(pre, node);
        } else if (/^(graph|digraph)\s+/i.test(trimmed)) {
          const pre = document.createElement('pre');
          const codeEl = document.createElement('code');
          codeEl.className = 'language-dot';
          codeEl.textContent = raw;
          pre.appendChild(codeEl);
          node.parentNode?.replaceChild(pre, node);
        }
      }
    });
  };

  // Function to render existing LaTeX expressions in the content
  const renderExistingMath = async () => {
    if (!editorRef.current) return;
    
    try {
      const katex = (await import('katex')).default;
      const mathElements = editorRef.current.querySelectorAll('.math-expression[data-latex]');
      
      mathElements.forEach((element) => {
        const latexExpression = element.getAttribute('data-latex');
        if (latexExpression) {
          try {
            const renderedMath = katex.renderToString(latexExpression, {
              throwOnError: false,
              displayMode: false,
            });
            element.innerHTML = renderedMath;
            (element as HTMLElement).style.display = 'inline-block';
            (element as HTMLElement).style.margin = '0 2px';
          } catch (error) {
            console.error('Error rendering existing LaTeX:', error);
            // Keep the original text if rendering fails
            element.innerHTML = `$${latexExpression}$`;
          }
        }
      });
    } catch (error) {
      console.error('Error loading KaTeX for existing math:', error);
    }
  };

  // Component for live LaTeX preview
  const MathPreview = ({ expression }: { expression: string }) => {
    const [renderedHtml, setRenderedHtml] = useState('');
    
    useEffect(() => {
      const renderPreview = async () => {
        if (!expression) {
          setRenderedHtml('x^2 + y^2 = r^2');
          return;
        }
        
        try {
          const katex = (await import('katex')).default;
          const rendered = katex.renderToString(expression, {
            throwOnError: false,
            displayMode: false,
          });
          setRenderedHtml(rendered);
        } catch (error) {
          // Fallback to plain text if rendering fails
          setRenderedHtml(`$${expression}$`);
        }
      };
      
      renderPreview();
    }, [expression]);
    
    return (
      <div 
        className="p-2 bg-white border rounded" 
        style={{ minHeight: '40px', display: 'flex', alignItems: 'center' }}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  };

  useEffect(() => {
    if (note) {
      console.log('RichTextEditor: Loading note:', note.title);
      console.log('RichTextEditor: Note content length:', note.content?.length || 0);
      setContent(note.content || '');
      setTitle(note.title || '');
      // Set editor content
      if (editorRef.current) {
  // Sanitize content on load
  (async () => {
    try {
      if (!DOMPurifyRef.current) {
        const DOMPurify = (await import('dompurify')).default as any;
        DOMPurifyRef.current = DOMPurify;
      }
  const sanitizer = DOMPurifyRef.current!;
  // Convert basic markdown before sanitization so new tags are cleaned too
  const mdConverted = normalizeBasicMarkdown(note.content || '');
  console.log('RichTextEditor: Markdown converted content length:', mdConverted.length);
  const sanitized = sanitizer.sanitize(mdConverted, {
        ALLOWED_URI_REGEXP: /^(?:(?:https?|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i,
        ADD_TAGS: [
          'span','img','pre','code',
          // SVG tags commonly used by Mermaid/Graphviz
          'svg','g','path','defs','marker','polygon','polyline','line','rect','circle','ellipse','text','tspan','style','clipPath','foreignObject','title','desc'
        ],
        ADD_ATTR: [
          'data-latex','style','class','id',
          'width','height','viewBox','xmlns','x','y','cx','cy','r','rx','ry',
          'points','x1','x2','y1','y2','d','transform','stroke','stroke-width','stroke-linecap','stroke-linejoin',
          'marker-end','marker-start','marker-mid','fill','fill-opacity','stroke-opacity','font-size','text-anchor',
          // Image-related attrs
          'src','alt','srcset','sizes','loading','referrerpolicy'
        ]
      });
      console.log('RichTextEditor: Sanitized content length:', sanitized.length);
      editorRef.current!.innerHTML = sanitized;
      console.log('RichTextEditor: Content set in editor');
      
  // Use a small delay to ensure DOM is fully ready before rendering
  setTimeout(async () => {
        try {
          // Transform any triple-backtick fences to code blocks
          isRenderingRef.current = true;
          normalizeCodeFences();
          console.log('RichTextEditor: Code fences normalized');
          
          // Render LaTeX and diagrams
          renderLatexBlocks();
          renderExistingMath();
          wrapBareMermaidBlocks();
          console.log('RichTextEditor: About to render graphs');
          
          // Render graphs with a small delay to ensure everything is ready
          await renderGraphs();
          // Schedule a follow-up render to catch late layout/visibility changes
          setTimeout(() => {
            try { renderGraphs(); } catch {}
          }, 200);
          console.log('RichTextEditor: Graph rendering completed');
        } catch (error) {
          console.error('RichTextEditor: Error during rendering:', error);
        } finally {
          isRenderingRef.current = false;
        }
      }, 150);
    } catch (e) {
      console.error('RichTextEditor: Error in content loading:', e);
      // Fallback without sanitization
      editorRef.current!.innerHTML = note.content || '';
      isRenderingRef.current = true;
      renderLatexBlocks();
      renderExistingMath();
      wrapBareMermaidBlocks();
      renderGraphs().finally(() => {
        isRenderingRef.current = false;
      });
    }
  })();
      }
    } else {
      setContent('');
      setTitle('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }
  }, [note]);

  // Observe edits/pastes and auto-render diagrams if mermaid-like content appears
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const scheduleRender = () => {
      if (isRenderingRef.current) return;
      if (renderTimerRef.current) window.clearTimeout(renderTimerRef.current);
      renderTimerRef.current = window.setTimeout(() => {
        try {
          isRenderingRef.current = true;
          normalizeCodeFences();
          wrapBareMermaidBlocks();
          renderGraphs().finally(() => {
            isRenderingRef.current = false;
          });
        } catch {
          isRenderingRef.current = false;
        }
      }, 200);
    };
  const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' || m.type === 'characterData') {
          // Ignore changes that occur inside our graph wrappers to avoid unnecessary rerenders
          const targetEl = (m.target as Node) as HTMLElement;
          if (targetEl && (targetEl.closest && targetEl.closest('.graph-renderer-wrapper'))) {
            continue;
          }
          const txt = el.innerText || '';
  if (/(^|\n)\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|plot|math|chem|vector)\b/i.test(txt) || txt.includes('```')) {
            scheduleRender();
            break;
          }
        }
      }
    });
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => {
      mo.disconnect();
      if (renderTimerRef.current) window.clearTimeout(renderTimerRef.current);
    };
  }, []);

  // Re-render graphs if the editor container resizes (e.g., when switching notes/panels)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    let timer: number | null = null;
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try { renderGraphs(); } catch {}
      }, 200);
    };
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => schedule());
      ro.observe(el);
    }
    return () => {
      if (ro && el) ro.unobserve(el);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const handleSave = async () => {
    if (!note) return;
    
    try {
      let currentContent = editorRef.current?.innerHTML || content;
      // Sanitize before saving
      if (!DOMPurifyRef.current) {
        const DOMPurify = (await import('dompurify')).default as any;
        DOMPurifyRef.current = DOMPurify;
      }
      const sanitizer = DOMPurifyRef.current!;
      currentContent = sanitizer.sanitize(currentContent, {
        ALLOWED_URI_REGEXP: /^(?:(?:https?|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i,
        ADD_TAGS: [
          'span','img','pre','code',
          'svg','g','path','defs','marker','polygon','polyline','line','rect','circle','ellipse','text','tspan','style','clipPath','foreignObject','title','desc'
        ],
        ADD_ATTR: [
          'data-latex','style','class','id',
          'width','height','viewBox','xmlns','x','y','cx','cy','r','rx','ry',
          'points','x1','x2','y1','y2','d','transform','stroke','stroke-width','stroke-linecap','stroke-linejoin',
          'marker-end','marker-start','marker-mid','fill','fill-opacity','stroke-opacity','font-size','text-anchor',
          'src','alt','srcset','sizes','loading','referrerpolicy'
        ]
      });
      // Persist to local notes store
      notesStore.updateNote(note.id, { title, content: currentContent });
      onSave(currentContent);
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveBtn.textContent = originalText;
        }, 1000);
      }
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  // Render LaTeX delimited with $$...$$ into KaTeX HTML
  const renderLatexBlocks = async () => {
    if (!editorRef.current) return;
    try {
      const katex = (await import('katex')).default;
      const html = editorRef.current.innerHTML;
      const replaced = html.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
        try {
          return katex.renderToString(String(expr).trim(), { throwOnError: false, displayMode: false });
        } catch {
          return `<span class="math-expression" data-latex="${String(expr).replace(/"/g, '&quot;')}">$${expr}$</span>`;
        }
      });
      editorRef.current.innerHTML = replaced;
    } catch (e) {
      // ignore if katex missing
    }
  };

  // Render graphs using the new GraphRenderer component
  const renderGraphs = async () => {
    if (!editorRef.current) return;
    
    try {
      console.log('Starting graph rendering with GraphRenderer...');
      
      const container = editorRef.current;
      console.log('Container found:', container);
      
  // Find all graph code blocks and wrap them with a persistent container for GraphRenderer
      const mermaidBlocks = Array.from(container.querySelectorAll(
  'pre code.language-mermaid, pre code.lang-mermaid, pre code.mermaid, pre code.language-plot, pre code.language-math, pre code.language-chem, pre code.language-vector, pre code.language-svg'
      )) as HTMLElement[];
      console.log('Found mermaid code blocks:', mermaidBlocks.length);
      
  for (const code of mermaidBlocks) {
        const text = code.textContent || '';
        const pre = code.closest('pre') as HTMLElement | null;
        if (!text.trim() || !pre) continue;

        // If already wrapped, just (re)render if needed
        const existingWrapper = pre.parentElement?.classList.contains('graph-renderer-wrapper')
          ? (pre.parentElement as HTMLElement)
          : null;

        try {
          console.log('Rendering graph with GraphRenderer:', text.substring(0, 100));

          let wrapper: HTMLElement;
          let mount: HTMLElement;
          if (existingWrapper) {
            wrapper = existingWrapper;
            mount = wrapper.querySelector('.graph-container') as HTMLElement;
            if (!mount) {
              mount = document.createElement('div');
              mount.className = 'graph-container';
              wrapper.appendChild(mount);
            } else {
              // If code hasn't changed and we already have content, skip re-render
              const prevSig = (mount as any).dataset.codeSig;
              const nextSig = String(text.length) + ':' + (text.slice(0, 32) || '');
              if (prevSig === nextSig && mount.childNodes.length > 0) {
                continue;
              }
              mount.innerHTML = '';
            }
          } else {
            // Create a wrapper div and move the pre inside (hidden)
            wrapper = document.createElement('div');
            wrapper.className = 'graph-renderer-wrapper';
            wrapper.style.cssText = 'margin: 20px 0; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; background: #f8f9fa;';
            pre.parentElement?.insertBefore(wrapper, pre);
            pre.style.display = 'none';
            wrapper.appendChild(pre);
            mount = document.createElement('div');
            mount.className = 'graph-container';
            wrapper.appendChild(mount);
          }

          // Render the graph using React into the mount container, reusing a persistent root map
          const anyWin = window as any;
          anyWin.__graphRoots = anyWin.__graphRoots || new WeakMap<HTMLElement, any>();
          let root = anyWin.__graphRoots.get(mount);
          if (!root) {
            root = ReactDOM.createRoot(mount);
            anyWin.__graphRoots.set(mount, root);
          }
          // Use a key on component to force remount when code changes
          const keyBase = String(text.length) + ':' + (text.slice(0, 32) || '');
          (mount as any).dataset.codeSig = keyBase;
          const rerenders = Number((mount as any).dataset.rerenders || '0');
          const key = `${keyBase}:${rerenders}`;
          root.render(<GraphRenderer key={key} graphCode={text} />);
          // One-time follow-up render to avoid initial blank due to timing/visibility
          if (rerenders === 0) {
            (mount as any).dataset.rerenders = '1';
            setTimeout(() => {
              const rrKey = `${keyBase}:1`;
              root.render(<GraphRenderer key={rrKey} graphCode={text} />);
            }, 100);
          }

          console.log('Graph rendered successfully with GraphRenderer');
        } catch (err) {
          console.error('GraphRenderer render failed:', err);
          // Keep the code block but add error styling
          const pre = code.closest('pre');
          if (pre) {
            pre.style.cssText = 'background-color: #fee; border: 1px solid #fcc; padding: 10px; border-radius: 4px;';
            pre.innerHTML = `<div style="color: #c33; margin-bottom: 10px;">⚠️ Graph rendering failed</div><code>${escapeHtml(text)}</code>`;
          }
        }
      }
      
  // Handle plain <pre> blocks that contain graph syntax
      const plainPres = Array.from(container.querySelectorAll('pre')) as HTMLElement[];
      console.log('Found plain pre blocks:', plainPres.length);
      
  for (const pre of plainPres) {
        if (pre.querySelector('code')) continue; // already handled above

        const text = (pre.innerText || '').trimStart();
  if (!/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|plot|math|chem|vector|svg)\b/i.test(text) && !/^<svg[\s>]/i.test(text)) continue;

        try {
          console.log('Rendering plain pre graph with GraphRenderer:', text.substring(0, 100));

          // If already wrapped, reuse it
          const existingWrapper = pre.parentElement?.classList.contains('graph-renderer-wrapper')
            ? (pre.parentElement as HTMLElement)
            : null;

          let wrapper: HTMLElement;
          let mount: HTMLElement;
          if (existingWrapper) {
            wrapper = existingWrapper;
            mount = wrapper.querySelector('.graph-container') as HTMLElement;
            if (!mount) {
              mount = document.createElement('div');
              mount.className = 'graph-container';
              wrapper.appendChild(mount);
            } else {
              const prevSig = (mount as any).dataset.codeSig;
              const nextSig = String(text.length) + ':' + (text.slice(0, 32) || '');
              if (prevSig === nextSig && mount.childNodes.length > 0) {
                continue;
              }
              mount.innerHTML = '';
            }
          } else {
            // Create a wrapper div and move the pre inside (hidden)
            wrapper = document.createElement('div');
            wrapper.className = 'graph-renderer-wrapper';
            wrapper.style.cssText = 'margin: 20px 0; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; background: #f8f9fa;';
            pre.parentElement?.insertBefore(wrapper, pre);
            pre.style.display = 'none';
            wrapper.appendChild(pre);
            mount = document.createElement('div');
            mount.className = 'graph-container';
            wrapper.appendChild(mount);
          }

          // Render the graph using React into the mount container, reusing a persistent root map
          const anyWin = window as any;
          anyWin.__graphRoots = anyWin.__graphRoots || new WeakMap<HTMLElement, any>();
          let root = anyWin.__graphRoots.get(mount);
          if (!root) {
            root = ReactDOM.createRoot(mount);
            anyWin.__graphRoots.set(mount, root);
          }
          const keyBase = String(text.length) + ':' + (text.slice(0, 32) || '');
          (mount as any).dataset.codeSig = keyBase;
          const rerenders = Number((mount as any).dataset.rerenders || '0');
          const key = `${keyBase}:${rerenders}`;
          root.render(<GraphRenderer key={key} graphCode={text} />);
          if (rerenders === 0) {
            (mount as any).dataset.rerenders = '1';
            setTimeout(() => {
              const rrKey = `${keyBase}:1`;
              root.render(<GraphRenderer key={rrKey} graphCode={text} />);
            }, 100);
          }

          console.log('Plain pre graph rendered successfully with GraphRenderer');
        } catch (err) {
          console.error('GraphRenderer plain pre render failed:', err);
          // Add error styling
          pre.style.cssText = 'background-color: #fee; border: 1px solid #fcc; padding: 10px; border-radius: 4px;';
          pre.innerHTML = `<div style="color: #c33; margin-bottom: 10px;">⚠️ Graph rendering failed</div><code>${escapeHtml(text)}</code>`;
        }
      }
      
      console.log('Graph rendering completed with GraphRenderer');
    } catch (e) {
      console.error('Graph render error:', e);
    }
  };

  // Manual refresh function for graphs
  const refreshGraphs = () => {
    console.log('Manual graph refresh triggered');
    try {
      isRenderingRef.current = true;
      renderGraphs();
      console.log('Manual graph refresh completed');
    } catch (error) {
      console.error('Manual graph refresh failed:', error);
    } finally {
      isRenderingRef.current = false;
    }
  };

  // Expose refresh function globally for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).refreshGraphs = refreshGraphs;
    }
  }, []);

  // Formatting functions
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    updateFormatState();
  };

  const updateFormatState = () => {
    setCurrentFormat({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      fontSize: document.queryCommandValue('fontSize') || '14',
      fontColor: document.queryCommandValue('foreColor') || '#000000',
      backgroundColor: document.queryCommandValue('backColor') || '#ffffff'
    });
  };

  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer) || 
          editorRef.current === range.commonAncestorContainer) {
        setSavedCursorPosition(range.cloneRange());
      }
    }
  };

  const restoreCursorPosition = () => {
    if (savedCursorPosition && editorRef.current) {
      try {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(savedCursorPosition);
        }
      } catch (error) {
        // If restoring fails, place cursor at end
        console.warn('Could not restore cursor position:', error);
      }
    }
  };

  const openMathModal = () => {
    saveCursorPosition();
    setShowMathModal(true);
  };

  const handleContentChange = () => {
    if (editorRef.current) {
      // Convert basic markdown inline when typing/pasting
      const html = editorRef.current.innerHTML;
      const converted = normalizeBasicMarkdown(html);
      if (converted !== html) {
        editorRef.current.innerHTML = converted;
      }
      setContent(editorRef.current.innerHTML);
      const text = editorRef.current.innerText;
      // Attempt diagram render on edits that include code fences or bare mermaid syntax
      if (text.includes('```')) {
  normalizeCodeFences();
  wrapBareMermaidBlocks();
  renderGraphs();
      }
  // Trigger on common mermaid starters too
  if (/(^|\n)\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)\b/i.test(text)) {
  normalizeCodeFences();
  wrapBareMermaidBlocks();
        renderGraphs();
      }
    }
  };

  // Enhanced Drawing functions
  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = drawingHistory.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    
    setDrawingHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;
    
    // Set initial background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Save initial state
    if (drawingHistory.length === 0) {
      saveCanvasState();
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      // Set drawing properties based on tool
      if (drawingTool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = brushColor;
        ctx.globalAlpha = brushOpacity;
      } else if (drawingTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
      }
      
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingMode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveCanvasState(); // Save state after each stroke
    }
  };

  const undoDrawing = () => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const newIndex = historyIndex - 1;
      const imageData = drawingHistory[newIndex];
      ctx.putImageData(imageData, 0, 0);
      setHistoryIndex(newIndex);
    }
  };

  const redoDrawing = () => {
    if (historyIndex < drawingHistory.length - 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const newIndex = historyIndex + 1;
      const imageData = drawingHistory[newIndex];
      ctx.putImageData(imageData, 0, 0);
      setHistoryIndex(newIndex);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveCanvasState();
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataURL = canvas.toDataURL('image/png');
    
    if (editingDrawingIndex !== null) {
      // Update existing drawing
      const updatedDrawings = [...savedDrawings];
      updatedDrawings[editingDrawingIndex] = dataURL;
      setSavedDrawings(updatedDrawings);
      setEditingDrawingIndex(null);
    } else {
      // Add new drawing
      setSavedDrawings([...savedDrawings, dataURL]);
    }
    
    // Insert drawing into editor
    if (editorRef.current) {
      const img = document.createElement('img');
      img.src = dataURL;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '10px 0';
      img.style.cursor = 'pointer';
      img.className = 'editable-drawing';
      
      // Add click handler to re-edit
      img.onclick = () => editDrawing(dataURL, savedDrawings.length - 1);
      
      editorRef.current.appendChild(img);
      editorRef.current.appendChild(document.createElement('br'));
      handleContentChange();
    }
    
    setIsDrawingMode(false);
    clearCanvas();
    setDrawingHistory([]);
    setHistoryIndex(-1);
  };

  const editDrawing = (dataURL: string, index: number) => {
    setIsDrawingMode(true);
    setEditingDrawingIndex(index);
    
    // Load the drawing onto canvas
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        saveCanvasState();
      };
      img.src = dataURL;
    }, 100);
  };

  const insertMath = async () => {
    if (!mathExpression || !editorRef.current) return;
    
    try {
      // Dynamically import katex
      const katex = (await import('katex')).default;
      
      // Render the LaTeX expression to HTML
      const renderedMath = katex.renderToString(mathExpression, {
        throwOnError: false,
        displayMode: false,
      });
      
      // Create a span with the rendered math
      const mathSpan = document.createElement('span');
      mathSpan.className = 'math-expression';
      mathSpan.style.display = 'inline-block';
      mathSpan.style.margin = '0 2px';
      mathSpan.setAttribute('data-latex', mathExpression);
      mathSpan.innerHTML = renderedMath;
      
      // Focus the editor
      editorRef.current.focus();
      
      // Try to restore saved cursor position first
      if (savedCursorPosition) {
        try {
          // Clear any selected content at the saved position
          savedCursorPosition.deleteContents();
          
          // Insert the math span
          savedCursorPosition.insertNode(mathSpan);
          
          // Create and insert a space after the math
          const spaceNode = document.createTextNode(' ');
          savedCursorPosition.setStartAfter(mathSpan);
          savedCursorPosition.insertNode(spaceNode);
          
          // Move cursor after the space
          savedCursorPosition.setStartAfter(spaceNode);
          savedCursorPosition.collapse(true);
          
          // Update selection
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(savedCursorPosition);
          }
          
          setSavedCursorPosition(null); // Clear saved position
        } catch (error) {
          console.warn('Could not use saved cursor position:', error);
          // Fall back to current selection
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (editorRef.current.contains(range.commonAncestorContainer)) {
              range.deleteContents();
              range.insertNode(mathSpan);
              const spaceNode = document.createTextNode(' ');
              range.setStartAfter(mathSpan);
              range.insertNode(spaceNode);
              range.setStartAfter(spaceNode);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              editorRef.current.appendChild(mathSpan);
              editorRef.current.appendChild(document.createTextNode(' '));
            }
          } else {
            editorRef.current.appendChild(mathSpan);
            editorRef.current.appendChild(document.createTextNode(' '));
          }
        }
      } else {
        // No saved position, use current selection
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            range.insertNode(mathSpan);
            const spaceNode = document.createTextNode(' ');
            range.setStartAfter(mathSpan);
            range.insertNode(spaceNode);
            range.setStartAfter(spaceNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            if (editorRef.current) {
              editorRef.current.appendChild(mathSpan);
              editorRef.current.appendChild(document.createTextNode(' '));
            }
          }
        } else {
          if (editorRef.current) {
            editorRef.current.appendChild(mathSpan);
            editorRef.current.appendChild(document.createTextNode(' '));
          }
        }
      }
      
      // Update content
      handleContentChange();
      
    } catch (error) {
      console.error('Error rendering LaTeX:', error);
      
      // Fallback: insert plain text
      const fallbackText = `$${mathExpression}$ `;
      
      if (savedCursorPosition) {
        try {
          savedCursorPosition.deleteContents();
          savedCursorPosition.insertNode(document.createTextNode(fallbackText));
          savedCursorPosition.collapse(false);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(savedCursorPosition);
          }
          setSavedCursorPosition(null);
        } catch (error) {
          if (editorRef.current) {
            editorRef.current.appendChild(document.createTextNode(fallbackText));
          }
        }
      } else {
        editorRef.current.focus();
        
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0 && editorRef.current) {
            const range = selection.getRangeAt(0);
            if (editorRef.current.contains(range.commonAncestorContainer)) {
              range.deleteContents();
              range.insertNode(document.createTextNode(fallbackText));
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              if (editorRef.current) {
                editorRef.current.appendChild(document.createTextNode(fallbackText));
              }
            }
          } else {
            if (editorRef.current) {
              editorRef.current.appendChild(document.createTextNode(fallbackText));
            }
          }
          
          handleContentChange();
        }, 10);
      }
    }
    
    // Reset and close modal
    setMathExpression('');
    setShowMathModal(false);
  };

  if (!note) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center text-gray-500 p-8">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-medium mb-2">Welcome to Notes</h3>
          <p className="text-sm">Select a note from the sidebar to start editing, or create a new one.</p>
          <div className="mt-6 text-xs text-gray-400">
            Use the + buttons in the sidebar to create folders and notes
          </div>
        </div>
      </div>
    );
  }

  // If this is a video note, render video player instead of editor
  if (note?.type === 'video' && note.video_path) {
    // Check if it's an HTML placeholder or real video
    const isHtmlPlaceholder = note.video_path.endsWith('.mp4'); // Our backend creates HTML files with .mp4 extension
    
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="border-b border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">🎥 {note.title}</h2>
            <div className="text-sm text-gray-500">
              Video Lesson • Created {new Date(note.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium mb-3">📹 Video Content</h3>
              
              {/* Try to detect if it's a real video first */}
              <div className="relative">
                {/* First try to load as video */}
                <video
                  controls
                  className="w-full max-w-3xl mx-auto rounded-lg shadow-lg"
                  style={{ maxHeight: '500px' }}
                  onError={(e) => {
                    // If video fails to load, hide it and show iframe
                    const video = e.target as HTMLVideoElement;
                    video.style.display = 'none';
                    const iframe = video.nextElementSibling as HTMLIFrameElement;
                    if (iframe) iframe.style.display = 'block';
                  }}
                >
                  <source src={note.video_path} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Fallback iframe for HTML placeholders (hidden by default) */}
                <iframe
                  src={note.video_path}
                  className="w-full max-w-3xl mx-auto rounded-lg shadow-lg"
                  style={{ 
                    height: '500px', 
                    border: 'none',
                    display: 'none' // Hidden by default, shown if video fails
                  }}
                  title={`Video content for ${note.title}`}
                />
              </div>
              
              <div className="text-center text-gray-500 mt-4">
                <p className="text-sm">
                  📁 File: {note.video_path}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  If you see an error, this video may be a placeholder. Install Manim for real video generation.
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-md font-medium text-blue-800 mb-2">📝 About This Video</h4>
              <p className="text-blue-700">
                This video was automatically generated using AI and Manim animations.
                It covers the topic: <strong>{note.title}</strong>
              </p>
              <div className="mt-3 text-sm text-blue-600">
                <p><strong>Created:</strong> {new Date(note.created_at).toLocaleString()}</p>
                <p><strong>File Path:</strong> {note.video_path}</p>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h5 className="text-sm font-medium text-yellow-800 mb-1">💡 How to Enable Real Video Generation</h5>
                <div className="text-xs text-yellow-700">
                  <p>1. Install Manim: <code className="bg-yellow-100 px-1 rounded">pip install manim</code></p>
                  <p>2. Install FFmpeg (required by Manim)</p>
                  <p>3. Restart the backend server</p>
                  <p>4. Create a new video to see real Manim animations!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none outline-none flex-1 min-w-0 text-black placeholder-gray-500"
            placeholder="Note title..."
          />
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
                isDrawingMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ✏️ {isDrawingMode ? 'Exit Draw' : 'Draw'}
            </button>
            <button
              onClick={openMathModal}
              className="px-3 py-1 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded text-sm whitespace-nowrap"
            >
              ∑ Math
            </button>
            <button
              id="save-btn"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
            >
              Save
            </button>
          </div>
        </div>

        {/* Toolbar - Horizontally scrollable */}
        {!isDrawingMode && (
          <div className="overflow-x-auto scrollbar-thin">
            <div className="flex items-center space-x-2 p-2 border border-gray-200 rounded bg-gray-50 min-w-max text-black">
              {/* Font Size */}
              <select
                value={currentFormat.fontSize}
                onChange={(e) => execCommand('fontSize', e.target.value)}
                className="px-2 py-1 border rounded text-sm text-black"
              >
                <option value="1">Small</option>
                <option value="3">Normal</option>
                <option value="5">Large</option>
                <option value="7">Huge</option>
              </select>

            {/* Bold, Italic, Underline */}
            <button
              onClick={() => execCommand('bold')}
              className={`px-2 py-1 rounded text-sm font-bold text-black ${
                currentFormat.bold ? 'bg-blue-200' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              B
            </button>
            <button
              onClick={() => execCommand('italic')}
              className={`px-2 py-1 rounded text-sm italic text-black ${
                currentFormat.italic ? 'bg-blue-200' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              I
            </button>
            <button
              onClick={() => execCommand('underline')}
              className={`px-2 py-1 rounded text-sm underline text-black ${
                currentFormat.underline ? 'bg-blue-200' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              U
            </button>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Text Color */}
            <div className="flex items-center space-x-1">
              <span className="text-sm text-black">Color:</span>
              <input
                type="color"
                value={currentFormat.fontColor}
                onChange={(e) => execCommand('foreColor', e.target.value)}
                className="w-8 h-8 border rounded cursor-pointer"
              />
            </div>

            {/* Background Color */}
            <div className="flex items-center space-x-1">
              <span className="text-sm text-black">Highlight:</span>
              <input
                type="color"
                value={currentFormat.backgroundColor}
                onChange={(e) => execCommand('backColor', e.target.value)}
                className="w-8 h-8 border rounded cursor-pointer"
              />
            </div>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Lists */}
            <button
              onClick={() => execCommand('insertUnorderedList')}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm text-black"
              title="Bullet List"
            >
              • List
            </button>
            <button
              onClick={() => execCommand('insertOrderedList')}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm text-black"
              title="Numbered List"
            >
              1. List
            </button>

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Alignment */}
            <button
              onClick={() => execCommand('justifyLeft')}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm text-black"
              title="Align Left"
            >
              ⬅
            </button>
            <button
              onClick={() => execCommand('justifyCenter')}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm text-black"
              title="Center"
            >
              ↔
            </button>
            <button
              onClick={() => execCommand('justifyRight')}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm text-black"
              title="Align Right"
            >
              ➡
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Enhanced Drawing Canvas Overlay */}
        {isDrawingMode && (
          <div className="absolute inset-0 z-10 bg-white flex flex-col">
            {/* Drawing Toolbar */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">
                  {editingDrawingIndex !== null ? 'Edit Drawing' : 'Drawing Mode'}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={undoDrawing}
                    disabled={historyIndex <= 0}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    title="Undo"
                  >
                    ↶ Undo
                  </button>
                  <button
                    onClick={redoDrawing}
                    disabled={historyIndex >= drawingHistory.length - 1}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    title="Redo"
                  >
                    ↷ Redo
                  </button>
                  <button
                    onClick={clearCanvas}
                    className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                    title="Clear Canvas"
                  >
                    🗑️ Clear
                  </button>
                  <button
                    onClick={saveDrawing}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    💾 {editingDrawingIndex !== null ? 'Update' : 'Save'} Drawing
                  </button>
                  <button
                    onClick={() => {
                      setIsDrawingMode(false);
                      setEditingDrawingIndex(null);
                      clearCanvas();
                      setDrawingHistory([]);
                      setHistoryIndex(-1);
                    }}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
              
              {/* Drawing Tools */}
              <div className="flex items-center space-x-4 flex-wrap gap-y-2">
                {/* Tool Selection */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Tool:</span>
                  <button
                    onClick={() => setDrawingTool('pen')}
                    className={`px-3 py-1 rounded text-sm ${
                      drawingTool === 'pen' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    ✏️ Pen
                  </button>
                  <button
                    onClick={() => setDrawingTool('eraser')}
                    className={`px-3 py-1 rounded text-sm ${
                      drawingTool === 'eraser' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    🧹 Eraser
                  </button>
                </div>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Brush Size */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Size:</span>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-gray-600 w-8">{brushSize}px</span>
                </div>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Color Selection */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Color:</span>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-10 h-8 border rounded cursor-pointer"
                    disabled={drawingTool === 'eraser'}
                  />
                  {/* Color Presets */}
                  <div className="flex space-x-1">
                    {['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setBrushColor(color)}
                        className="w-6 h-6 border border-gray-300 rounded cursor-pointer hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        disabled={drawingTool === 'eraser'}
                      />
                    ))}
                  </div>
                </div>

                <div className="w-px h-6 bg-gray-300"></div>

                {/* Opacity */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Opacity:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={brushOpacity}
                    onChange={(e) => setBrushOpacity(Number(e.target.value))}
                    className="w-16"
                    disabled={drawingTool === 'eraser'}
                  />
                  <span className="text-sm text-gray-600 w-8">{Math.round(brushOpacity * 100)}%</span>
                </div>
              </div>
            </div>
            
            {/* Canvas Area */}
            <div className="flex-1 flex items-center justify-center p-4 bg-gray-100">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className={`border-2 border-gray-300 bg-white rounded shadow-lg ${
                  drawingTool === 'pen' ? 'cursor-crosshair' : 'cursor-cell'
                }`}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startDrawing(e);
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  draw(e);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopDrawing();
                }}
                style={{ touchAction: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Rich Text Editor */}
        <div className="flex-1 p-4">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning={true}
            onInput={handleContentChange}
            onKeyUp={updateFormatState}
            onMouseUp={updateFormatState}
            className="w-full h-96 p-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-auto scrollbar-thin text-editor-scrollable text-black"
            style={{ 
              minHeight: '400px', 
              maxHeight: '600px',
              maxWidth: '100%',
              whiteSpace: 'pre-wrap', 
              wordWrap: 'break-word',
              overflowX: 'auto',
              overflowY: 'auto',
              overflowWrap: 'break-word',
              scrollbarWidth: 'auto',
              scrollbarColor: '#6B7280 #F9FAFB',
              resize: 'both',
              boxSizing: 'border-box'
            }}
            data-placeholder="Start writing your note..."
          />
          
          {/* Saved Drawings Section */}
          {savedDrawings.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-4 text-gray-700">Saved Drawings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedDrawings.map((drawing, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50 relative group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Drawing {index + 1}</span>
                      <button
                        onClick={() => editDrawing(savedDrawings[index], index)}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit Drawing"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                    <img 
                      src={drawing} 
                      alt={`Drawing ${index + 1}`} 
                      className="w-full h-auto border rounded shadow cursor-pointer hover:shadow-lg transition-shadow" 
                      onClick={() => editDrawing(savedDrawings[index], index)}
                      style={{ maxHeight: '200px', objectFit: 'contain' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Math Modal */}
      {showMathModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="font-semibold mb-4">Insert Math Expression</h3>
            <p className="text-sm text-gray-600 mb-2">Enter LaTeX expression:</p>
            <input
              type="text"
              value={mathExpression}
              onChange={(e) => setMathExpression(e.target.value)}
              placeholder="e.g., x^2 + y^2 = r^2"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && insertMath()}
            />
            <div className="text-sm text-gray-500 mb-4 p-3 bg-gray-50 rounded border">
              <div className="mb-2 font-medium">Preview:</div>
              <MathPreview expression={mathExpression} />
              <div className="text-xs text-gray-400 mt-2">
                Examples: x^2, \\frac&#123;1&#125;&#123;2&#125;, \\sqrt&#123;x&#125;, \\sum_&#123;k=1&#125;^&#123;n&#125; k, \\alpha, \\beta
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowMathModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={insertMath}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

