"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the side menu of the
// planning panel: single pages and groups of pages ("Planning", "Bride
// Board"), each page shown only to the roles that may open it.
// ============================================================================

import { isNavGroup, visibleNavTree, type NavNode, type NavPage } from "./nav";
import styles from "./GroupedNav.module.css";

// Adapted from the side menu in angela-simon-wedding/components/panel/PanelApp.tsx.
//
// Controlled: the app keeps the active page and gets onSelect. Only the pages
// the person may open are shown (see visibleNavTree); a group shows when at
// least one of its pages does. Define the tree once at module level, with a
// permission key on every page.

export type GroupedNavProps = {
  tree: NavNode[];
  // Each permission key -> allowed or not. Pages without access are left out.
  access: Record<string, boolean>;
  // The key of the page that is open.
  active: string;
  onSelect: (key: string) => void;
  // The accessible name of the menu. Default "Main navigation".
  label?: string;
  className?: string;
};

export default function GroupedNav({ tree, access, active, onSelect, label = "Main navigation", className }: GroupedNavProps) {
  const visible = visibleNavTree(tree, access);

  function pageButton(page: NavPage, inGroup: boolean) {
    const classes = [styles.page, inGroup ? styles.sub : "", active === page.key ? styles.active : ""].join(" ").trim();
    return (
      <button type="button" className={classes} key={page.key} title={page.title} aria-current={active === page.key ? "page" : undefined} onClick={() => onSelect(page.key)}>
        {page.icon}
        <span>{page.title}</span>
      </button>
    );
  }

  return (
    <nav className={className ? `${styles.nav} ${className}` : styles.nav} aria-label={label}>
      {visible.map((node) =>
        isNavGroup(node) ? (
          <div className={styles.group} key={node.group}>
            <p className={styles.groupTitle}>{node.group}</p>
            {node.pages.map((page) => pageButton(page, true))}
          </div>
        ) : (
          pageButton(node, false)
        )
      )}
    </nav>
  );
}
