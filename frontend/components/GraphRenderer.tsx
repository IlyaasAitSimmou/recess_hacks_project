'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, ArcElement } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import * as d3 from 'd3';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface GraphData {
  type: 'flowchart' | 'line-chart' | 'bar-chart' | 'pie-chart' | 'scatter-plot' | 'network' | 'math-plot' | 'chemistry' | 'vector' | 'svg';
  data: any;
  options?: any;
}

interface GraphRendererProps {
  graphCode: string;
  onRenderComplete?: () => void;
}

export default function GraphRenderer({ graphCode, onRenderComplete }: GraphRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const markerIdRef = useRef<string>(`arrowhead-${Math.random().toString(36).slice(2)}`);
  const renderSeqRef = useRef(0);

  // Parse Mermaid-like syntax and convert to Chart.js or D3.js data
  const parseGraphCode = (code: string): GraphData | null => {
    try {
      const lines = code
        .split('\n')
        .map(l => l.replace(/\r$/, ''))
        .filter(l => l.trim().length > 0);
      if (lines.length === 0) return null;
      // Find the first non-comment directive line
      const headerLine = (lines.find(l => !l.trim().startsWith('%%')) || lines[0]).toLowerCase();

      // SVG: either fenced as `svg` header or raw <svg ...>
      const raw = code.trim();
      if (/^\s*<svg[\s>]/i.test(raw) || /^\s*svg\b/i.test(headerLine)) {
        return parseSvgDiagram(lines);
      }

      // Detect graph type
      if (headerLine.includes('graph') || headerLine.includes('flowchart')) {
        return parseFlowchart(lines);
      } else if (headerLine.includes('sequence')) {
        return parseSequenceDiagram(lines);
      } else if (headerLine.includes('class')) {
        return parseClassDiagram(lines);
      } else if (headerLine.includes('pie')) {
        return parsePieChart(lines);
      } else if (/^plot\b|^math\b/i.test(headerLine)) {
        return parsePlotDiagram(lines);
  } else if (/^chem\b|^chemistry\b|^smiles\b/i.test(headerLine)) {
        return parseChemDiagram(lines);
      } else if (/^vector\b/i.test(headerLine)) {
        return parseVectorDiagram(lines);
      } else {
        // Heuristic: if content looks like a raw SMILES string, treat as chemistry
        const raw = code.trim();
        const isSingleLine = !raw.includes('\n');
        const smilesLike = /^[A-Za-z0-9@+\-#=()\\/\[\]]+$/.test(raw) && /[cCnNOPSFI0-9=()]/.test(raw);
        if (isSingleLine && smilesLike && raw.length <= 200) {
          return { type: 'chemistry', data: { smiles: raw } };
        }
        // Default to flowchart
        return parseFlowchart(lines);
      }
    } catch (err) {
      console.error('Error parsing graph code:', err);
      return null;
    }
  };

  // Parse flowchart syntax
  const parseFlowchart = (lines: string[]): GraphData => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map<string, any>();
    
    // Detect direction (optional)
    let direction: 'LR' | 'TB' | 'BT' | 'RL' = 'LR';
    const dirMatch = lines[0].match(/^(graph|flowchart)\s+([A-Z]{2})/i);
    if (dirMatch) {
      const dir = dirMatch[2].toUpperCase();
      if (dir === 'TB' || dir === 'BT' || dir === 'RL' || dir === 'LR') direction = dir as any;
    }

    const ensureNode = (id: string, label?: string) => {
      if (!nodeMap.has(id)) {
        const node = { id, label: (label ?? id).replace(/['"]/g, '') };
        nodeMap.set(id, node);
        nodes.push(node);
      }
      return nodeMap.get(id);
    };

    const nodeRegexes = [
      /(\w+)\s*\[([^\]]+)\]/,                 // A[Label]
      /(\w+)\s*\(\(([^)]+)\)\)/,              // A((Label))
      /(\w+)\s*\(([^)]+)\)/,                    // A(Label)
      /(\w+)\s*\{([^}]+)\}/,                    // A{Label}
      /(\w+)\s*\[\[([^\]]+)\]\]/             // A[[Label]]
    ];
    const edgeRegexes = [
      /(\w+)\s*-+[^>]*>\s*(\w+)/,               // A --> B or A ----> B
      /(\w+)\s*==+[^>]*>\s*(\w+)/,              // A ==> B (styled)
      /(\w+)\s*-{2,}\s*(\w+)/                   // A ---- B (undirected)
    ];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // skip headers, comments, and blocks we don't handle
      if (
        !line ||
        line.startsWith('graph') ||
        line.startsWith('flowchart') ||
        line.startsWith('%%') ||
        line.startsWith('subgraph') ||
        line === 'end'
      ) continue;

      // Try node definitions in various shapes
      let matchedNode = false;
      for (const rx of nodeRegexes) {
        const m = line.match(rx);
        if (m) {
          const id = m[1];
          const label = (m[2] || m[3] || m[4] || m[5] || m[6]) as string | undefined;
          ensureNode(id, label);
          matchedNode = true;
          break;
        }
      }

      // Try edges; create implicit nodes when not defined
      for (const rx of edgeRegexes) {
        const m = line.match(rx);
        if (m) {
          const from = m[1];
          const to = m[2];
          ensureNode(from);
          ensureNode(to);
          edges.push({ from, to });
          break;
        }
      }
    }

    // Deterministic simple layout (grid/line) so it doesn't bunch at 0,0
    const W = 800;
    const H = 480;
    const n = nodes.length || 1;
    const cols = direction === 'TB' || direction === 'BT' ? Math.ceil(Math.sqrt(n)) : n;
    const rows = direction === 'TB' || direction === 'BT' ? Math.ceil(n / cols) : 1;
    nodes.forEach((node, i) => {
      const col = direction === 'TB' || direction === 'BT' ? i % cols : i;
      const row = direction === 'TB' || direction === 'BT' ? Math.floor(i / cols) : 0;
      const xStep = W / (cols + 1);
      const yStep = rows > 1 ? H / (rows + 1) : H / 2;
      node.x = (col + 1) * xStep;
      node.y = rows > 1 ? (row + 1) * yStep : yStep;
    });

    return { type: 'flowchart', data: { nodes, edges, nodeMap, direction, width: W, height: H } };
  };

  // Parse free-form SVG
  const parseSvgDiagram = (lines: string[]): GraphData => {
    // If first directive is 'svg', drop it and treat the rest as markup; else join all
    const first = lines[0].trim();
    let markup = '';
    if (/^svg\b/i.test(first)) {
      markup = lines.slice(1).join('\n').trim();
    } else {
      markup = lines.join('\n').trim();
    }
    // If it's not a full <svg> document, wrap it in a simple viewport
    if (!/^<svg[\s>]/i.test(markup)) {
      markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">\n${markup}\n</svg>`;
    }
    return { type: 'svg', data: { markup } };
  };

  // Parse sequence diagram
  const parseSequenceDiagram = (lines: string[]): GraphData => {
    // Convert to a simple left-to-right flow of participants with message edges
    const participantsOrder: string[] = [];
    const nodes: any[] = [];
    const nodeMap = new Map<string, any>();
    const edges: any[] = [];

    const addParticipant = (name: string) => {
      if (!nodeMap.has(name)) {
        const node = { id: name, label: name };
        nodeMap.set(name, node);
        nodes.push(node);
        participantsOrder.push(name);
      }
    };

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('sequence')) continue;
      if (trimmed.startsWith('participant')) {
        const match = trimmed.match(/participant\s+(\w+)(?:\s+as\s+(.+))?/);
        if (match) {
          addParticipant((match[2] || match[1]).trim());
        }
        continue;
      }
      // Messages: A->>B: text or A->B: text
      const msg = trimmed.match(/(\w+)\s*-?>+\s*(\w+)\s*:\s*(.+)/);
      if (msg) {
        const from = msg[1];
        const to = msg[2];
        addParticipant(from);
        addParticipant(to);
        edges.push({ from, to });
      }
    }

    // Simple LR layout will be applied by flow layout
    return { type: 'flowchart', data: { nodes, edges, nodeMap, direction: 'LR' } };
  };

  // Parse class diagram
  const parseClassDiagram = (lines: string[]): GraphData => {
    // Convert classes to nodes, relationships to edges
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map<string, any>();

    const ensureClass = (name: string) => {
      if (!nodeMap.has(name)) {
        const node = { id: name, label: name };
        nodeMap.set(name, node);
        nodes.push(node);
      }
      return nodeMap.get(name);
    };

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('classDiagram')) continue;
      const cls = trimmed.match(/class\s+(\w+)\s*\{([^}]*)\}/);
      if (cls) {
        const name = cls[1];
        ensureClass(name);
        continue;
      }
      const rel = trimmed.match(/(\w+)\s*<\|--\s*(\w+)/);
      if (rel) {
        ensureClass(rel[1]);
        ensureClass(rel[2]);
        edges.push({ from: rel[2], to: rel[1] });
      }
    }

    return { type: 'flowchart', data: { nodes, edges, nodeMap, direction: 'LR' } };
  };

  // Parse pie chart
  const parsePieChart = (lines: string[]): GraphData => {
    const data: any[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      // skip header lines like: pie, pie showData, title, %% comments
      if (
        /^pie\b/i.test(trimmed) ||
        /^title\b/i.test(trimmed) ||
        /^showdata\b/i.test(trimmed) ||
        trimmed.startsWith('%%')
      ) return;
      if (trimmed.includes(':')) {
        const [label, value] = trimmed.split(':').map(s => s.trim());
        if (label && value) {
          data.push({
            label: label.replace(/['"]/g, ''),
            value: parseFloat(value) || Math.random() * 100
          });
        }
      }
    });
    
    return {
      type: 'pie-chart',
      data: data
    };
  };

  // Parse simple function plot definitions
  // Syntax:
  // plot
  // f(x) = sin(x)
  // g(x) = x^2 - 4
  // domain: -10..10
  const parsePlotDiagram = (lines: string[]): GraphData => {
    let domain: [number, number] = [-10, 10];
    const exprs: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || /^plot\b|^math\b|^%%/.test(line)) continue;
      const d = line.match(/domain\s*:\s*([+-]?[0-9]*\.?[0-9]+)\s*\.\.?\s*([+-]?[0-9]*\.?[0-9]+)/i);
      if (d) {
        const a = parseFloat(d[1]);
        const b = parseFloat(d[2]);
        if (!Number.isNaN(a) && !Number.isNaN(b) && a < b) domain = [a, b];
        continue;
      }
      const eq = line.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/);
      if (eq) {
        exprs.push(eq[1].trim());
        continue;
      }
      // bare expression line
      if (/^[^=]+$/.test(line)) exprs.push(line);
    }
    if (!exprs.length) exprs.push('sin(x)');
    return { type: 'math-plot', data: { expressions: exprs, domain } };
  };

  // Render flowchart using D3.js
  const renderFlowchart = (data: any) => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    container.innerHTML = '';
    const width = data.width || 600;
    const height = data.height || 400;
    
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    // Create arrow marker
    const markerId = (markerIdRef.current as unknown as string) || `arrowhead-${Math.random().toString(36).slice(2)}`;
    svg.append('defs').append('marker')
      .attr('id', markerId)
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0 -5 L 10 0 L 0 5')
      .attr('fill', '#999');
    
  // Draw edges
  if (data.edges && data.edges.length) {
      svg.selectAll('.edge')
        .data(data.edges)
        .enter()
        .append('line')
        .attr('class', 'edge')
        .attr('x1', (d: any) => data.nodeMap.get(d.from)?.x || 0)
        .attr('y1', (d: any) => data.nodeMap.get(d.from)?.y || 0)
        .attr('x2', (d: any) => data.nodeMap.get(d.to)?.x || 0)
        .attr('y2', (d: any) => data.nodeMap.get(d.to)?.y || 0)
        .attr('stroke', '#999')
        .attr('stroke-width', 2)
  .attr('marker-end', `url(#${markerId})`);
    }
    
    // Draw nodes
  if (data.nodes && data.nodes.length) {
      const nodeGroups = svg.selectAll('.node')
        .data(data.nodes)
        .enter()
        .append('g')
        .attr('class', 'node');
      
      // Node rectangles
      nodeGroups.append('rect')
        .attr('x', (d: any) => d.x - 40)
        .attr('y', (d: any) => d.y - 20)
        .attr('width', 80)
        .attr('height', 40)
        .attr('rx', 5)
        .attr('fill', '#fff')
        .attr('stroke', '#333')
        .attr('stroke-width', 2);
      
      // Node labels
      nodeGroups.append('text')
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y + 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#333')
        .text((d: any) => d.label);
    } else {
      // If nothing to draw, show a friendly message
      const g = svg.append('g');
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#666')
        .text('No nodes detected in diagram');
    }
  };

  // Parse chemistry diagram (SMILES)
  const parseChemDiagram = (lines: string[]): GraphData => {
    // Expect a line like: smiles: C1=CC=CC=C1 (benzene)
    let smiles: string | null = null;
    const alias: Record<string, string> = {
      benzene: 'c1ccccc1',
      water: 'O',
      ethanol: 'CCO',
      methanol: 'CO',
      acetone: 'CC(=O)C',
      glucose: 'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@H]1O' // rough; for demo
    };
    for (const raw of lines) {
      let line = raw.trim();
      // Skip only the top-level header and comments, not the 'smiles:' definition line
  if (!line || /^chem\b/i.test(line) || /^chemistry\b/i.test(line) || /^smiles\b$/i.test(line) || /^%%/.test(line)) continue;
      // Drop trailing comments in parentheses or after '#'
      line = line.replace(/#.*/, '').replace(/\([^)]*\)$/, '').trim();
      const m = line.match(/smiles\s*:\s*(.+)$/i);
      if (m) { smiles = m[1].trim(); break; }
      if (!smiles) smiles = line; // treat bare first non-header as SMILES
    }
    if (smiles) {
      smiles = smiles.replace(/^['"]|['"]$/g, '').trim();
      const key = smiles.toLowerCase();
      if (alias[key]) smiles = alias[key];
    }
    return { type: 'chemistry', data: { smiles } };
  };

  // Render chemistry using smiles-drawer (prefer Canvas to avoid null sizing issues)
  const renderChemistry = async (data: { smiles: string }, seq: number) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    // Ensure the container has dimensions for any SVG sizing logic
    container.style.minWidth = container.style.minWidth || '800px';
    container.style.minHeight = container.style.minHeight || '480px';
    try {
      const mod: any = await import('smiles-drawer');
      const SD: any = mod?.default || mod;
      const parseFn: any = SD?.parse || SD?.Parser?.parse;
      if (!parseFn) {
        const div = document.createElement('div');
        div.style.color = '#c33';
        div.textContent = 'Chemistry renderer not ready (parse missing). Check smiles-drawer version.';
        container.appendChild(div);
        console.error('smiles-drawer exports:', Object.keys(SD || {}));
        return;
      }
      if (seq !== renderSeqRef.current) return;

      const WIDTH = 800;
      const HEIGHT = 480;

      const drawWithCanvas = (tree: any) => {
        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        canvas.style.background = '#ffffff';
        const cid = 'chem-canvas-' + Math.random().toString(36).slice(2);
        canvas.id = cid;
        container.appendChild(canvas);
        const CanvasDrawer = SD?.CanvasDrawer || SD?.Drawer; // fallback to Drawer
        const drawer = new CanvasDrawer({ width: WIDTH, height: HEIGHT, padding: 10, compactDrawing: true });
        try { (drawer as any).draw(tree, cid, 'light'); }
        catch { (drawer as any).draw(tree, canvas, 'light'); }
      };

      const drawWithSvg = (tree: any) => {
        const host = document.createElement('div');
        host.style.width = `${WIDTH}px`;
        host.style.height = `${HEIGHT}px`;
        const hid = 'chem-host-' + Math.random().toString(36).slice(2);
        host.id = hid;
        container.appendChild(host);
        const SvgDrawer = SD?.SvgDrawer || SD?.Drawer; // fallback to Drawer
        const drawer = new SvgDrawer({ width: WIDTH, height: HEIGHT, padding: 10, compactDrawing: true });
        try { (drawer as any).draw(tree, hid, 'light'); }
        catch { (drawer as any).draw(tree, host, 'light'); }
      };

      const tryParseAndDraw = (smilesStr: string, attemptedFallback = 0) => {
        if (!smilesStr || !smilesStr.trim()) {
          const div = document.createElement('div');
          div.style.color = '#c33';
          div.textContent = 'No SMILES provided.';
          container.appendChild(div);
          return;
        }
        parseFn(
          smilesStr,
          (tree: any) => {
            const doDraw = () => {
              if (seq !== renderSeqRef.current) return;
              // Try static convenience API first if available (handles parse+draw internally)
              try {
                if (typeof SD?.draw === 'function') {
                  const cid = 'chem-canvas-' + Math.random().toString(36).slice(2);
                  const c = document.createElement('canvas');
                  c.id = cid; c.width = WIDTH; c.height = HEIGHT; c.style.background = '#ffffff';
                  container.appendChild(c);
                  SD.draw(smilesStr, cid, 'light');
                  return;
                }
              } catch (e0) {
                console.warn('Static SD.draw failed, falling back to manual drawers...', e0);
              }
              // Try canvas first as it is most stable across environments
              try { drawWithCanvas(tree); return; } catch (e1) { console.warn('Canvas draw failed, trying SVG...', e1); }
              try { drawWithSvg(tree); return; } catch (e2) {
                const msg = (e2 as any)?.message || 'Unknown error';
                const errDiv = document.createElement('div');
                errDiv.style.color = '#c33';
                errDiv.textContent = `Chemistry render failed. ${msg}`.trim();
                container.appendChild(errDiv);
                console.error('SmilesDrawer draw error:', e2);
              }
            };
            if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
              requestAnimationFrame(doDraw);
            } else {
              setTimeout(doDraw, 0);
            }
          },
          (parseErr: any) => {
            if (attemptedFallback < 2) {
              const once = smilesStr.replace(/C1=CC=CC=C1/g, 'c1ccccc1').replace(/\s+/g, '');
              if (once !== smilesStr) {
                tryParseAndDraw(once, attemptedFallback + 1);
                return;
              }
            }
            const div = document.createElement('div');
            div.style.color = '#c33';
            div.textContent = `Failed to parse SMILES. ${parseErr?.message || ''}`.trim();
            container.appendChild(div);
            console.error('SmilesDrawer parse error:', parseErr);
          }
        );
      };

      tryParseAndDraw(data.smiles);
    } catch (e) {
      const div = document.createElement('div');
      div.style.color = '#c33';
      div.textContent = `Chemistry renderer not available. ${(e as any)?.message || ''}`.trim();
      container.appendChild(div);
      console.error('Failed to load smiles-drawer:', e);
    }
  };

  // Parse simple vector diagram
  // Syntax:
  // vector
  // axes: -10..10 x -10..10
  // vec (0,0) -> (3,4) label: v
  const parseVectorDiagram = (lines: string[]): GraphData => {
    let xdom: [number, number] = [-10, 10];
    let ydom: [number, number] = [-10, 10];
    const vectors: { from: [number, number]; to: [number, number]; label?: string }[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || /^vector\b|^%%/.test(line)) continue;
      const axes = line.match(/axes\s*:\s*([+-]?[0-9.]+)\s*\.\.?\s*([+-]?[0-9.]+)\s*x\s*([+-]?[0-9.]+)\s*\.\.?\s*([+-]?[0-9.]+)/i);
      if (axes) {
        xdom = [parseFloat(axes[1]), parseFloat(axes[2])];
        ydom = [parseFloat(axes[3]), parseFloat(axes[4])];
        continue;
      }
      const v = line.match(/vec\s*\(\s*([+-]?[0-9.]+)\s*,\s*([+-]?[0-9.]+)\s*\)\s*->\s*\(\s*([+-]?[0-9.]+)\s*,\s*([+-]?[0-9.]+)\s*\)(?:\s*label\s*:\s*(.*))?/i);
      if (v) {
        vectors.push({ from: [parseFloat(v[1]), parseFloat(v[2])], to: [parseFloat(v[3]), parseFloat(v[4])], label: v[5]?.trim() });
      }
    }
    return { type: 'vector', data: { xdom, ydom, vectors } };
  };

  const renderVector = (data: { xdom: [number, number]; ydom: [number, number]; vectors: any[] }) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const width = 800, height = 480;
    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);
    const x = d3.scaleLinear().domain(data.xdom).range([50, width - 20]);
    const y = d3.scaleLinear().domain(data.ydom).range([height - 30, 20]);
    // axes
    svg.append('g').attr('transform', `translate(0,${y(0)})`).call(d3.axisBottom(x) as any);
    svg.append('g').attr('transform', `translate(${x(0)},0)`).call(d3.axisLeft(y) as any);
    // vectors
    const markerId = (markerIdRef.current as unknown as string) || `arrowhead-${Math.random().toString(36).slice(2)}`;
    svg.append('defs').append('marker')
      .attr('id', markerId)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 6)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', '#c33');
    for (const v of data.vectors) {
      svg.append('line')
        .attr('x1', x(v.from[0])).attr('y1', y(v.from[1]))
        .attr('x2', x(v.to[0])).attr('y2', y(v.to[1]))
        .attr('stroke', '#c33').attr('stroke-width', 2).attr('marker-end', `url(#${markerId})`);
      if (v.label) {
        svg.append('text').attr('x', x(v.to[0]) + 5).attr('y', y(v.to[1]) - 5).attr('fill', '#333').text(v.label);
      }
    }
  };

  // Render math plots via function-plot (D3-based)
  const renderMathPlot = async (data: { expressions: string[]; domain: [number, number] }) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const { default: functionPlot } = await import('function-plot');
    try {
      // Use an id selector to avoid DOM mutation race conditions
      const plotId = 'plot-' + Math.random().toString(36).slice(2);
      const targetDiv = document.createElement('div');
      targetDiv.id = plotId;
      container.appendChild(targetDiv);
      functionPlot({
        target: `#${plotId}`,
        width: 800,
        height: 480,
        xAxis: { domain: data.domain },
        data: data.expressions.map(expr => ({ fn: expr }))
      } as any);
    } catch (e) {
      const div = document.createElement('div');
      div.style.color = '#c33';
      div.textContent = 'Failed to render plot.';
      container.appendChild(div);
    }
  };

  // Main render function
  const renderGraph = async () => {
    if (!graphCode.trim()) return;
    const mySeq = ++renderSeqRef.current;
    
    setIsRendering(true);
    setError(null);
    
    try {
      const parsed = parseGraphCode(graphCode);
      if (!parsed) {
        throw new Error('Failed to parse graph code');
      }
      
      setGraphData(parsed);
      
      // Render based on type
      switch (parsed.type) {
        case 'flowchart':
          renderFlowchart(parsed.data);
          break;
        case 'pie-chart':
          // Pie will be rendered via JSX below
          break;
        case 'math-plot':
          await renderMathPlot(parsed.data);
          break;
        case 'chemistry':
          await renderChemistry(parsed.data, mySeq);
          break;
        case 'vector':
          renderVector(parsed.data);
          break;
        case 'svg': {
          // Safe SVG injection using DOMPurify
          const { default: DOMPurify } = await import('dompurify');
          const allowed = {
            ALLOWED_URI_REGEXP: /^(?:(?:https?|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i,
            ADD_TAGS: [
              'svg','g','path','defs','marker','polygon','polyline','line','rect','circle','ellipse','text','tspan','style','clipPath','foreignObject','title','desc','pattern','linearGradient','stop'
            ],
            ADD_ATTR: [
              'style','class','id','width','height','viewBox','xmlns','x','y','cx','cy','r','rx','ry','points','x1','x2','y1','y2','d','transform','stroke','stroke-width','stroke-linecap','stroke-linejoin','marker-end','marker-start','marker-mid','fill','fill-opacity','stroke-opacity','font-size','text-anchor'
            ]
          } as any;
          if (containerRef.current) {
            containerRef.current.innerHTML = DOMPurify.sanitize(parsed.data.markup, allowed);
          }
          break;
        }
        default:
          renderFlowchart(parsed.data);
      }
      
      onRenderComplete?.();
    } catch (err) {
      console.error('Graph rendering failed:', err);
      setError(err instanceof Error ? err.message : 'Graph rendering failed');
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    // Clear container before any render to avoid overlaying old SVG/canvas
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    renderGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphCode]);

  if (isRendering) {
    return (
      <div className="graph-renderer-loading">
        <div className="loading-spinner">🔄</div>
        <p>Rendering graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="graph-renderer-error">
        <div className="error-icon">⚠️</div>
        <h4>Graph Rendering Failed</h4>
        <p>{error}</p>
        <details>
          <summary>Original Code</summary>
          <pre><code>{graphCode}</code></pre>
        </details>
      </div>
    );
  }

  // For pie chart, render via react-chartjs-2 to avoid nested React roots issues
  if (graphData?.type === 'pie-chart') {
    const chartData = {
      labels: graphData.data.map((d: any) => d.label),
      datasets: [{
        data: graphData.data.map((d: any) => d.value),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
          '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };
    const options = {
      responsive: true,
      plugins: {
        legend: { position: 'top' as const },
        title: { display: true, text: 'Pie Chart' }
      }
    };
    return (
      <div className="graph-renderer">
        <Doughnut data={chartData} options={options} />
      </div>
    );
  }

  return (
    <div className="graph-renderer">
  <div ref={containerRef} className="graph-container" />
    </div>
  );
}

// Import ReactDOM for rendering
import ReactDOM from 'react-dom/client';
