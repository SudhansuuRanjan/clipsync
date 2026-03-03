import { LogOut } from "lucide-react";

export default function SessionBadge({ sessionCode, isDarkMode, onLeave }) {
    const dm = isDarkMode;

    if (!sessionCode) return null;

    return (
        <div className={`flex flex-col items-center gap-1 py-3 px-4 rounded-xl
            ${dm ? "bg-blue-500/10 border border-blue-500/20" : "bg-blue-50 border border-blue-100"}`}>
            <div className={`flex items-center gap-2 text-sm font-medium ${dm ? "text-gray-300" : "text-gray-700"}`}>
                Session Active:
                <span className={`font-mono font-bold tracking-widest text-base px-2 py-0.5 rounded-lg
                    ${dm ? "text-blue-400 bg-blue-500/10" : "text-blue-600 bg-blue-100"}`}>
                    {sessionCode.toUpperCase()}
                </span>
                <button
                    aria-label="Leave Session"
                    title="Leave Session"
                    className="text-red-400 hover:text-red-500 active:scale-95 transition ml-1"
                    onClick={onLeave}
                >
                    <LogOut size={15} />
                </button>
            </div>
            <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>
                Join on another device using this code to sync
            </p>
        </div>
    );
}
