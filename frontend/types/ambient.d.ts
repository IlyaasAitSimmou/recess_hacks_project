declare module 'mermaid' {
  const mermaid: any;
  export default mermaid;
}

declare module 'dompurify' {
  const DOMPurify: any;
  export default DOMPurify;
}

declare module '@aduh95/viz.js' {
  export default class Viz {
    constructor(options: any);
    renderString(dot: string, options?: any): Promise<string>;
  }
}

declare module '@aduh95/viz.js/full.render.js' {
  export const Module: any;
  export const render: any;
}

declare module 'function-plot' {
  const functionPlot: any;
  export default functionPlot;
}

// Optional OpenChemLib if loaded via script tag/CDN at runtime
declare global {
  interface Window { OCL?: any }
}
