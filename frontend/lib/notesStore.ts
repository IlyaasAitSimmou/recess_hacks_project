'use client';

// Lightweight notes store with localStorage persistence and pub-sub updates.

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
  type?: 'note' | 'video';
  video_path?: string;
}

type Listener = () => void;

interface NotesState {
  folders: Folder[];
  notes: Note[];
}

const LS_KEY = 'notesStore.v1';

function nowISO() {
  return new Date().toISOString();
}

function loadInitial(): NotesState {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  // Seed with a tiny sample so the UI isn't empty
  const seed: NotesState = {
    folders: [
      { id: 1, name: 'Math', parent_id: null, created_at: nowISO() },
      { id: 2, name: 'Science', parent_id: null, created_at: nowISO() },
    ],
    notes: [
      {
        id: 1,
        title: 'Limits and Derivatives',
        content: `
          <h2>Limits</h2>
          <p>Example: $$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$</p>
          <h2>Derivative</h2>
          <p>Definition: $$f'(x)= \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}$$</p>
        `,
        folder_id: 1,
        created_at: nowISO(),
        updated_at: nowISO(),
      },
    ],
  };
  return seed;
}

let state: NotesState = loadInitial();
const listeners: Set<Listener> = new Set();

function persist() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function nextId(list: { id: number }[]): number {
  return list.length ? Math.max(...list.map((i) => i.id)) + 1 : 1;
}

export const notesStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getState(): NotesState {
    return JSON.parse(JSON.stringify(state));
  },

  // Folders
  listFolders(): Folder[] {
    return [...state.folders];
  },
  createFolder(name: string, parent_id: number | null = null): Folder {
    const f: Folder = { id: nextId(state.folders), name, parent_id, created_at: nowISO() };
    state.folders.push(f);
    emit();
    return f;
  },
  updateFolder(id: number, patch: Partial<Pick<Folder, 'name' | 'parent_id'>>): Folder | null {
    const idx = state.folders.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    state.folders[idx] = { ...state.folders[idx], ...patch };
    emit();
    return state.folders[idx];
  },
  moveFolder(id: number, newParentId: number | null): void {
    // prevent cycles by disallowing moving folder into its own subtree
    if (id === newParentId) return;
    const childIds = this.getFolderSubtreeIds(id);
    if (newParentId && childIds.has(newParentId)) return;
    this.updateFolder(id, { parent_id: newParentId });
  },
  deleteFolder(id: number): void {
    // recursively delete child folders and their notes
    const toDelete = Array.from(this.getFolderSubtreeIds(id));
    state.folders = state.folders.filter((f) => !toDelete.includes(f.id));
    state.notes = state.notes.filter((n) => !toDelete.includes(n.folder_id ?? -1));
    emit();
  },
  getFolderSubtreeIds(rootId: number): Set<number> {
    const result = new Set<number>([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of state.folders) {
        if (f.parent_id != null && result.has(f.parent_id) && !result.has(f.id)) {
          result.add(f.id);
          changed = true;
        }
      }
    }
    return result;
  },

  // Notes
  listNotes(folder_id: number | null = null): Note[] {
    return state.notes.filter((n) => n.folder_id === folder_id);
  },
  getAllNotes(): Note[] {
    return [...state.notes];
  },
  findNoteById(id: number): Note | undefined {
    return state.notes.find((n) => n.id === id);
  },
  createNote(title: string, content = '', folder_id: number | null = null): Note {
    const n: Note = {
      id: nextId(state.notes),
      title: title || 'Untitled',
      content,
      folder_id,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    state.notes.push(n);
    emit();
    return n;
  },
  createVideoNote(title: string, videoPath: string, folder_id: number | null): Note {
    const n: Note = {
      id: nextId(state.notes),
      title,
      content: `Video lesson: ${title}`,
      folder_id,
      type: 'video',
      video_path: videoPath,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    state.notes.push(n);
    emit();
    return n;
  },
  updateNote(id: number, patch: Partial<Omit<Note, 'id'>>): Note | null {
    const idx = state.notes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    state.notes[idx] = { ...state.notes[idx], ...patch, updated_at: nowISO() };
    emit();
    return state.notes[idx];
  },
  moveNote(id: number, folder_id: number | null): void {
    this.updateNote(id, { folder_id });
  },
  deleteNote(id: number): void {
    state.notes = state.notes.filter((n) => n.id !== id);
    emit();
  },
};

export type { NotesState };
