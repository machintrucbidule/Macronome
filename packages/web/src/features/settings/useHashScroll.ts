import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// B-310: bring `/settings#update` to the card it names.
//
// A hash in the URL only scrolls the document on a full page load. Inside the SPA the browser
// never sees a navigation, so React Router leaves the hash inert — the link from À propos would
// have dropped the user at the top of a long page. The offset is CSS's job (`.card`'s
// `scroll-margin-top`, which clears the sticky app bar), not this hook's.
//
// It runs after the page has mounted its cards, and does nothing when there is no hash or the
// target does not exist — an anchor that stops matching degrades to a plain navigation.
export function useHashScroll(): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ block: 'start' });
  }, [hash]);
}
