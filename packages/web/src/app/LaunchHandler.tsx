import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { launchTargetPath } from '../lib/pwa/launchQueue';

// Consumes the Web LaunchQueue so app shortcuts / deep links navigate when the installed app
// is ALREADY open (B-183 follow-up). With `launch_handler: focus-existing` the browser focuses
// the window and enqueues the target URL here; we soft-navigate the SPA to it (no reload).
// Renders nothing; inert in browser tabs / engines without launchQueue (Firefox can't install
// PWAs anyway). Mounted once under <BrowserRouter> so useNavigate has router context.
export function LaunchHandler(): null {
  const navigate = useNavigate();
  useEffect(() => {
    const queue = window.launchQueue;
    if (!queue) return; // browser tab / engine without the LaunchQueue API → inert
    queue.setConsumer((params) => {
      const current = window.location.pathname + window.location.search;
      const path = launchTargetPath(params.targetURL, current);
      if (path) void navigate(path);
    });
  }, [navigate]);
  return null;
}
