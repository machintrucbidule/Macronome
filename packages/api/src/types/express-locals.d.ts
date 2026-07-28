import 'express';

// Per-request diagnostic state carried on `res.locals` (B-231). Declared because `res.locals` is
// otherwise `Record<string, any>`, which the type-aware lint rules reject on every access.
declare module 'express-serve-static-core' {
  interface Locals {
    /** Set only for genuine authentication attempts; drives the error-envelope `ref`. */
    diag?: {
      ref: string;
      route: string;
      /** true = the store had the presented session · false = none · null = unknown. */
      sessionFound: boolean | null;
    };
    /** The contract error code the response settled on, for the black-box record. */
    errorCode?: string;
  }
}
