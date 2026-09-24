/** Remembers which secrets this visitor found. Works (in memory) even when storage is blocked. */
export class Journal {
  private static KEY = 'wingedsheep:found';
  private found: Set<string>;

  constructor(private total: number) {
    this.found = new Set(read(Journal.KEY));
  }

  has(id: string) {
    return this.found.has(id);
  }

  get count() {
    return this.found.size;
  }

  get size() {
    return this.total;
  }

  /** Returns true the first time a secret is found. */
  discover(id: string): boolean {
    if (this.found.has(id)) return false;
    this.found.add(id);
    write(Journal.KEY, [...this.found]);
    return true;
  }
}

function read(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}

function write(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the journal simply won't persist */
  }
}
