import { useState } from "react";
import { Eye, Moon, Share, Sun } from "lucide-react";

export default function TopBar({ isDarkMode, toggleDarkMode, uniqueVisitor, totalVisitor }) {
    const dm = isDarkMode;
    const [showStats, setShowStats] = useState(false);

    const handleShare = async () => {
        await navigator.share({
            title: "Clipboard Sync",
            text: "Join my clipboard session to sync clipboard content between devices",
            url: window.location.href,
        });
    };

    const btnClass = `p-2 rounded-full transition-all shadow-md 
        ${dm
            ? "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`;

    return (
        <div className="fixed top-4 z-[100] right-4 flex gap-2 items-start">

            {/* Eye button with stats popover */}
            <div className="relative">
                <button
                    onClick={() => setShowStats(p => !p)}
                    aria-label="View Stats"
                    className={btnClass}
                >
                    <Eye size={18} />
                </button>

                {showStats && (
                    <>
                        {/* Backdrop to close */}
                        <div className="fixed inset-0 z-10" onClick={() => setShowStats(false)} />
                        <div className={`absolute right-0 top-11 z-20 rounded-xl shadow-xl border text-xs min-w-[150px] p-3 space-y-2
                            ${dm ? "bg-[#1e2530] border-[#30363d] text-gray-300" : "bg-white border-gray-200 text-gray-700"}`}>
                            <p className={`font-semibold text-[11px] mb-1 ${dm ? "text-gray-500" : "text-gray-400"}`}>
                                Visitor Stats
                            </p>
                            <div className="flex justify-between gap-6">
                                <span className={dm ? "text-gray-500" : "text-gray-400"}>Unique</span>
                                <span className="text-blue-500 font-semibold">{uniqueVisitor.toLocaleString()}</span>
                            </div>
                            <div className={`w-full h-px ${dm ? "bg-[#30363d]" : "bg-gray-100"}`} />
                            <div className="flex justify-between gap-6">
                                <span className={dm ? "text-gray-500" : "text-gray-400"}>Total</span>
                                <span className="text-blue-500 font-semibold">{totalVisitor.toLocaleString()}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <button onClick={handleShare} aria-label="Share" className={btnClass}>
                <Share size={18} />
            </button>

            <button onClick={toggleDarkMode} aria-label="Toggle Dark Mode" className={btnClass}>
                {dm ? <Sun size={18} /> : <Moon size={18} />}
            </button>
        </div>
    );
}
