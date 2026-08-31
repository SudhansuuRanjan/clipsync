import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, RefreshCw, Smartphone } from "lucide-react";
import { createPair } from "../service/api";

const PAIR_OVERLAY_MS = 30_000;

export default function QrDock({ sessionCode, isDarkMode }) {
    const dm = isDarkMode;
    const canvasRef = useRef(null);
    const [activePair, setActivePair] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    // Build the URL the QR encodes. With an active pair we include ?pair=xxxxxx
    // so scanning immediately starts the handoff; otherwise it's just the origin.
    const buildUrl = () => {
        const u = new URL(window.location.href);
        u.search = "";
        if (activePair) u.searchParams.set("pair", activePair.pair);
        return activePair ? u.toString() : window.location.origin;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        QRCode.toCanvas(canvas, buildUrl(), {
            width: 180,
            margin: 1,
            color: {
                dark: dm ? "#e2e8f0" : "#0f172a",
                light: dm ? "#0d1117" : "#ffffff",
            },
            errorCorrectionLevel: "M",
        }).catch(() => {
            // silent: dock still shows the caption
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePair, dm]);

    // Auto-clear the pair overlay once it expires or the overlay window lapses.
    useEffect(() => {
        if (!activePair) return;
        const remaining = activePair.expiresAt - Date.now();
        if (remaining <= 0) {
            setActivePair(null);
            return;
        }
        const t = setTimeout(() => setActivePair(null), Math.min(remaining, PAIR_OVERLAY_MS));
        return () => clearTimeout(t);
    }, [activePair]);

    const handleShowPair = async () => {
        if (!sessionCode) return;
        setIsCreating(true);
        try {
            const data = await createPair(sessionCode);
            setActivePair({ pair: data.pair, expiresAt: data.expiresAt });
        } catch {
            // fail silently; dock keeps working
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <aside
            aria-label="Mobile handoff"
            className={`hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-2 p-3 rounded-2xl border shadow-xl
                ${dm
                    ? "bg-[#161b22] border-[#30363d] text-gray-200"
                    : "bg-white border-gray-200 text-gray-800"}`}
        >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <Smartphone size={13} className="text-blue-500" />
                Open on phone
            </div>
            <div className="rounded-lg p-1.5" style={{ background: dm ? "#0d1117" : "#ffffff" }}>
                <canvas ref={canvasRef} width={180} height={180} aria-label="QR code linking to this site" />
            </div>
            <p className={`text-[10px] text-center leading-snug max-w-[180px] ${dm ? "text-gray-500" : "text-gray-500"}`}>
                Scan with your phone to sync the same session.
            </p>

            {activePair ? (
                <div className="flex flex-col items-center gap-1 mt-1 w-full">
                    <span className={`text-[10px] uppercase tracking-wider ${dm ? "text-gray-500" : "text-gray-400"}`}>
                        Pair code
                    </span>
                    <code className={`text-2xl font-mono font-bold tracking-[0.2em] ${dm ? "text-blue-400" : "text-blue-600"}`}>
                        {activePair.pair}
                    </code>
                    <p className={`text-[9px] text-center ${dm ? "text-gray-600" : "text-gray-400"}`}>
                        One-time use, expires in {Math.max(1, Math.ceil((activePair.expiresAt - Date.now()) / 60000))} min
                    </p>
                    <button
                        type="button"
                        aria-label="Refresh pair code"
                        className={`mt-1 flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border
                            ${dm
                                ? "border-[#30363d] text-gray-300 hover:bg-[#1e2530]"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        onClick={handleShowPair}
                    >
                        <RefreshCw size={11} /> Refresh
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    aria-label="Show pair code"
                    className={`mt-1 flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border
                        ${dm
                            ? "border-[#30363d] text-gray-300 hover:bg-[#1e2530]"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    onClick={handleShowPair}
                    disabled={!sessionCode || isCreating}
                >
                    <QrCode size={12} /> {isCreating ? "Generating..." : "Show pair code"}
                </button>
            )}
        </aside>
    );
}
