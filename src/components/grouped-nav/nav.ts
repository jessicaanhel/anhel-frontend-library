// The menu tree and what a person may see of it. No React runtime and no Node
// imports (the icon type is only a type).
// Adapted from NAV_TREE, visibleTree and firstPage in
// angela-simon-wedding/components/panel/PanelApp.tsx.

import type { ReactNode } from "react";

export type NavPage = {
  key: string; // what onSelect receives
  title: string;
  icon?: ReactNode;
  // The permission key a person needs to see (and open) the page.
  permission: string;
};

// A titled group of pages. It shows when at least one of its pages does.
export type NavGroup = {
  group: string;
  icon?: ReactNode;
  pages: NavPage[];
};

export type NavNode = NavPage | NavGroup;

export function isNavGroup(node: NavNode): node is NavGroup {
  return "group" in node;
}

// The pages a person may open, in menu order: a group keeps only its allowed
// pages and disappears when it has none. `access` maps permission keys to
// allowed or not (e.g. built with auth.can for every key).
export function visibleNavTree(tree: NavNode[], access: Record<string, boolean>): NavNode[] {
  return tree.flatMap((node): NavNode[] => {
    if (isNavGroup(node)) {
      const pages = node.pages.filter((page) => access[page.permission]);
      return pages.length ? [{ ...node, pages }] : [];
    }
    return access[node.permission] ? [node] : [];
  });
}

// Every page of the tree, groups flattened.
export function allNavPages(tree: NavNode[]): NavPage[] {
  return tree.flatMap((node) => (isNavGroup(node) ? node.pages : [node]));
}

// The key of the first page this person may open (where they land), or null
// when they may open none.
export function firstNavPage(tree: NavNode[], access: Record<string, boolean>): string | null {
  const first = allNavPages(visibleNavTree(tree, access))[0];
  return first ? first.key : null;
}

// The title of a page by its key (the key itself when there is no such page).
export function navPageTitle(tree: NavNode[], key: string) {
  return allNavPages(tree).find((page) => page.key === key)?.title ?? key;
}
