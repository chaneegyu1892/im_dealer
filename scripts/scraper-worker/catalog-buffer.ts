export interface CatalogResultBuffer<T> {
  add(entry: T): void;
  size(): number;
  flush(options: { required: boolean }): Promise<boolean>;
}

export function createCatalogResultBuffer<T>(
  postEntries: (entries: T[]) => Promise<void>
): CatalogResultBuffer<T> {
  let entries: T[] = [];

  return {
    add(entry) {
      entries.push(entry);
    },
    size() {
      return entries.length;
    },
    async flush({ required }) {
      if (entries.length === 0) return true;
      const pending = entries;
      entries = [];
      try {
        await postEntries(pending);
        return true;
      } catch (error) {
        entries = pending.concat(entries);
        if (required) throw error;
        return false;
      }
    },
  };
}
