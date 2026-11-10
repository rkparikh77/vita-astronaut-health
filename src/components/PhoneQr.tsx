"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import QRCode from "qrcode";

/**
 * "Open on your phone": a QR code for this page. On localhost it swaps in the Mac's Wi-Fi address
 * (from /api/lan, dev only) so a phone on the same network can scan it.
 */
export function PhoneQr() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>();
  const [svg, setSvg] = useState<string>();
  const [note, setNote] = useState<string>();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const here = new URL(window.location.href);
      let target = here.toString();
      setNote(undefined);
      if (["localhost", "127.0.0.1", "[::1]"].includes(here.hostname)) {
        try {
          const r = await fetch("/api/lan");
          const { addresses } = (await r.json()) as { addresses: string[] };
          if (addresses.length) {
            here.hostname = addresses[0];
            target = here.toString();
          } else setNote("No Wi-Fi address found. Connect this Mac to Wi-Fi.");
        } catch {
          setNote("Couldn't look up this Mac's network address.");
        }
        setNote((n) => n ?? "Your phone must be on the same Wi-Fi, and the dev server must run with `npm run dev:phone`.");
      }
      const out = await QRCode.toString(target, { type: "svg", margin: 1, color: { dark: "#07090d", light: "#ffffff" } });
      if (!cancelled) {
        setUrl(target);
        setSvg(out);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-1.5 rounded-md border border-line-2 px-2.5 py-1.5 text-xs text-ink-2 hover:text-ink md:inline-flex"
        aria-label="Open on your phone"
      >
        <Smartphone size={14} /> On phone
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="panel ticks w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Open VITA on your phone">
            <div className="flex items-center justify-between">
              <h2 className="panel-title">Open on your phone</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="mx-auto mt-4 w-56 overflow-hidden rounded-xl bg-white p-2">
              {svg ? (
                // SVG produced locally by the qrcode library from this page's URL (no user HTML).
                <div role="img" aria-label="QR code for this page" className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
              ) : (
                <div className="aspect-square" />
              )}
            </div>
            {url && <p className="font-data mt-3 text-center text-[11px] break-all text-ink-2">{url}</p>}
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-2">
              <li>Scan with the iPhone camera.</li>
              <li>
                In Safari, tap <b className="text-ink">Share → Add to Home Screen</b>.
              </li>
              <li>Open VITA from the home screen: it runs full-screen like an app.</li>
            </ol>
            {note && <p className="mt-3 text-xs text-ink-3">{note}</p>}
          </div>
        </div>
      )}
    </>
  );
}
