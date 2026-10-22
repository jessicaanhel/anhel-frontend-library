// The matching behind the search dialog. No React and no Node imports.
// Adapted from the hit list in angela-simon-wedding/components/panel/SearchDialog.tsx.

// One thing that can be found. `data` is whatever the app needs to open it
// again (a page name, an id): it is handed back unchanged when picked.
export type SearchHit<T = unknown> = {
  id: string;
  label: string; // the first line
  detail?: string; // the second line, also searched
  data?: T;
};

// A group of things that can be found, e.g. all tasks, with the name that is
// shown (and searched) in front of each one's detail line.
export type SearchSection<T = unknown> = {
  title: string;
  hits: SearchHit<T>[];
};

export type FoundHit<T = unknown> = SearchHit<T> & { section: string };

// The hits whose label, section title or detail contains the query (any
// case), in the order of the sections, at most `limit`. Nothing for an empty query.
export function searchSections<T>(sections: SearchSection<T>[], query: string, limit = 15): FoundHit<T>[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const found: FoundHit<T>[] = [];
  for (const section of sections) {
    for (const hit of section.hits) {
      const haystack = `${hit.label} ${section.title} ${hit.detail ?? ""}`.toLowerCase();
      if (haystack.includes(needle)) found.push({ ...hit, section: section.title });
      if (found.length >= limit) return found;
    }
  }
  return found;
}
