"use client";

import { Check, Copy, LoaderCircle, QrCode as QrIcon, TriangleAlert, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { QrCode } from "@/components/QrCode";
import { deviceAddress, type AddressReach, type DeviceAddress } from "@/lib/address";
import { api } from "@/lib/api";
import type { TailscaleStatus } from "@/lib/types";

const WHO_CAN_SCAN: Record<AddressReach, string> = {
  "this-computer": "Scan with a tablet or phone on your home Wi-Fi.",
  "home-network": "Scan with a tablet or phone on your home Wi-Fi.",
  tailnet:
    "Scan with a phone or tablet that has the Tailscale app, signed in to your Tailscale account. Then it works at home or away, on any Wi-Fi or mobile data.",
  anywhere: "Scan with any phone or tablet, at home or away: any Wi-Fi or mobile data works.",
};

/**
 * Copies text. Home addresses like http://192.168.1.20:3000 aren't "secure
 * contexts", so browsers hide the Clipboard API there; fall back to selecting
 * a hidden text box (inside the dialog, since a modal makes the page inert).
 */
async function copyText(text: string, container: HTMLElement): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the fallback.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.readOnly = true;
  area.style.position = "fixed";
  area.style.opacity = "0";
  container.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  return copied;
}

/** Why the QR code only works on this computer, and what fixes it. */
function ThisComputerOnly({ tailscale }: { tailscale: TailscaleStatus }) {
  let fix: ReactNode;
  if (tailscale.state === "not-connected") {
    fix = tailscale.loginUrl ? (
      <>
        SnS Palace isn&apos;t signed in to Tailscale yet.{" "}
        <a href={tailscale.loginUrl} target="_blank" rel="noreferrer" className="font-bold underline">
          Sign it in
        </a>
        , then open this again.
      </>
    ) : (
      <>
        SnS Palace isn&apos;t signed in to Tailscale yet. Check <span className="font-mono">TS_AUTHKEY</span> in{" "}
        <span className="font-mono">.env</span> and run <span className="font-mono">docker compose up -d</span>;{" "}
        <span className="font-mono">docker compose logs tailscale</span> shows what went wrong.
      </>
    );
  } else if (tailscale.state === "https-off") {
    fix = (
      <>
        Tailscale is connected, but HTTPS is off. In the Tailscale admin console, open <b>DNS</b> and press{" "}
        <b>Enable HTTPS</b>, then open this again.
      </>
    );
  } else {
    fix = (
      <>
        Open SnS Palace with the computer&apos;s network address (like{" "}
        <span className="font-mono">http://192.168.1.20:3000</span>) and this code will use that instead.
      </>
    );
  }
  return (
    <p className="mt-3 flex gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200 ring-1 ring-amber-300/20">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>This address only works on this computer. {fix}</span>
    </p>
  );
}

/**
 * Shows a QR code that opens SnS Palace on a kid's tablet in one scan: the
 * page's own address, or this device's Tailscale address when the page was
 * opened in a way other devices can't use (such as http://localhost:3000).
 * The new device still has to pass the family PIN.
 */
export function AddDeviceButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [address, setAddress] = useState<DeviceAddress | null>(null);
  const [tailscale, setTailscale] = useState<TailscaleStatus>({ state: "off" });
  const [copied, setCopied] = useState<boolean | null>(null);
  const url = address?.url ?? null;
  const reach = address?.reach ?? "home-network";

  const open = async () => {
    setAddress(null);
    setCopied(null);
    dialog.current?.showModal();
    const status = await api<TailscaleStatus>("/api/tailscale").catch((): TailscaleStatus => ({ state: "off" }));
    setTailscale(status);
    setAddress(deviceAddress(`${window.location.origin}/`, status));
  };

  const copy = async () => {
    if (!url || !dialog.current) return;
    setCopied(await copyText(url, dialog.current));
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-violet-400"
      >
        <QrIcon aria-hidden className="size-4" /> Add a device
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="add-device-title"
        // A click on the backdrop (the dialog element itself) closes it.
        onClick={(event) => event.target === dialog.current && dialog.current.close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl bg-slate-900 p-6 text-slate-100 ring-1 ring-white/10 backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="add-device-title" className="font-display text-2xl font-semibold text-white">
            Open on another device
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-3 focus-visible:outline-violet-400"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-400">{WHO_CAN_SCAN[reach]} It still asks for the family PIN.</p>

        {url && address ? (
          <>
            <QrCode value={url} label={`QR code for ${url}`} className="mx-auto mt-5 w-full max-w-64 rounded-2xl" />
            <p className="mt-3 text-center font-mono text-sm break-all text-violet-200">{url}</p>
            {address.homeUrl ? (
              <p className="mt-2 text-center text-xs text-slate-400">
                On the home Wi-Fi, devices without Tailscale can also use
                <span className="block font-mono break-all text-slate-300">{address.homeUrl}</span>
              </p>
            ) : null}
            {reach === "this-computer" ? <ThisComputerOnly tailscale={tailscale} /> : null}
            <button
              type="button"
              onClick={() => void copy()}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied === null ? "Copy link" : copied ? "Copied!" : "Couldn't copy: select the link above"}
            </button>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              <span className="font-bold text-slate-300">Make it an app:</span> on the tablet, open the link, then tap{" "}
              <span className="font-bold text-slate-300">Share → Add to Home Screen</span> (iPhone, iPad) or{" "}
              <span className="font-bold text-slate-300">⋮ → Add to Home screen</span> (Android). It gets the castle icon
              and opens without the browser bars{url.startsWith("https:") ? "." : " (on Android, that needs an https:// address)."}
            </p>
          </>
        ) : (
          <p className="mx-auto mt-5 grid aspect-square w-full max-w-64 place-items-center rounded-2xl bg-white/5 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> Finding the best address…
            </span>
          </p>
        )}
      </dialog>
    </>
  );
}
