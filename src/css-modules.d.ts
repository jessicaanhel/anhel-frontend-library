// Lets TypeScript understand `import styles from "./X.module.css"` when the
// library is type-checked on its own. In a consuming app (Next.js, Vite...)
// the app's own bundler types take over.
declare module "*.module.css" {
  const classes: { readonly [className: string]: string };
  export default classes;
}
