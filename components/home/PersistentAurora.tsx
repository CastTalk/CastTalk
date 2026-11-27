'use client';

import { usePathname } from 'next/navigation';
import EmberAurora from './EmberAurora';

// Pages that show the aurora behind their heading
const AURORA_ROUTES = new Set(['/', '/cast-ai']);

/**
 * One aurora for the whole app shell. It lives in the layout, so switching pages
 * never tears it down and re-creates it (no pop-in). On pages without it, it
 * fades out and pauses instead of unmounting.
 */
const PersistentAurora = () => {
  const pathname = usePathname();
  return <EmberAurora visible={AURORA_ROUTES.has(pathname ?? '')} />;
};

export default PersistentAurora;
