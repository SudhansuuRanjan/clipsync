import { Moon, Sun, Share } from "lucide-react";

export default function TopBar({ isDarkMode, toggleDarkMode }) {
    const dm = isDarkMode;

    const handleShare = async () => {
        await navigator.share({
            title: "Clipboard Sync",
            text: "Join my clipboard session to sync clipboard content between devices",
            url: window.location.href,
        });
    };

    return (
        <div className="fixed top-4 z-[100] right-4 flex gap-2">
            <button
                onClick={handleShare}
                aria-label="Share"
                className={`p-2 rounded-full transition-all shadow-md 
                    ${dm
                        ? "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                        : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}
            >
                <Share size={18} />
            </button>

            <button
                onClick={toggleDarkMode}
                aria-label="Toggle Dark Mode"
                className={`p-2 rounded-full transition-all shadow-md 
                    ${dm
                        ? "bg-gray-800 text-amber-400 hover:bg-gray-700 border border-gray-700"
                        : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}
            >
                {dm ? <Sun size={18} /> : <Moon size={18} />}
            </button>
        </div>
    );
}
