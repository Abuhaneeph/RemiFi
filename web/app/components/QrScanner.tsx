"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseWalletFromQr } from "../lib/qr";

type QrScannerProps = {
  onScan: (value: string) => void;
  onError?: (message: string) => void;
  /** When true, only return parsed wallet addresses. */
  walletOnly?: boolean;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector(): (new (opts: {
  formats: string[];
}) => BarcodeDetectorLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  };
  return w.BarcodeDetector ?? null;
}

export function qrScannerSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    getBarcodeDetector() != null
  );
}

export function QrScanner({ onScan, onError, walletOnly = false }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState("");

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const handlePayload = useCallback(
    (raw: string) => {
      const value = walletOnly ? parseWalletFromQr(raw) : raw.trim();
      if (!value) {
        onError?.("No valid wallet address in that QR code.");
        return;
      }
      stopCamera();
      onScan(value);
    },
    [onError, onScan, stopCamera, walletOnly]
  );

  useEffect(() => {
    const Detector = getBarcodeDetector();
    if (!Detector || !active) return;

    let cancelled = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = new Detector({ formats: ["qr_code"] });

        const tick = async () => {
          if (cancelled || !video.videoWidth) {
            rafRef.current = requestAnimationFrame(() => void tick());
            return;
          }
          try {
            const codes = await detector.detect(video);
            const raw = codes[0]?.rawValue;
            if (raw) {
              handlePayload(raw);
              return;
            }
          } catch {
            /* frame skip */
          }
          rafRef.current = requestAnimationFrame(() => void tick());
        };

        rafRef.current = requestAnimationFrame(() => void tick());
      } catch {
        onError?.("Camera access denied or unavailable.");
        setActive(false);
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [active, handlePayload, onError, stopCamera]);

  const supported = qrScannerSupported();

  return (
    <div className="scan-stack">
      {supported ? (
        <>
          <div className="scan-viewfinder">
            <video ref={videoRef} playsInline muted />
            {!active ? (
              <div className="scan-viewfinder-idle">
                Tap start to use your camera
              </div>
            ) : (
              <span className="scan-line" aria-hidden />
            )}
            <span className="scan-corner scan-corner-tl" aria-hidden />
            <span className="scan-corner scan-corner-tr" aria-hidden />
            <span className="scan-corner scan-corner-bl" aria-hidden />
            <span className="scan-corner scan-corner-br" aria-hidden />
          </div>
          <button
            type="button"
            className="btn btn-outline btn-block mt-4"
            onClick={() => setActive((v) => !v)}
          >
            {active ? "Stop camera" : "Start camera"}
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">
          Camera QR scan needs Chrome or Edge. Paste an address below instead.
        </p>
      )}

      <label className="form-label mt-5" htmlFor="qr-manual">
        Paste QR content or wallet address
      </label>
      <input
        id="qr-manual"
        type="text"
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder="0x… or ethereum:0x…"
        className="form-field mt-2 w-full font-mono text-sm"
        spellCheck={false}
      />
      <button
        type="button"
        className="btn btn-gradient btn-block mt-3"
        disabled={!manual.trim()}
        onClick={() => handlePayload(manual)}
      >
        Use address
      </button>
    </div>
  );
}
