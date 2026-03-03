export default function JoinSessionForm({ inputCode, setInputCode, onSubmit, isDarkMode, isLoading }) {
    const dm = isDarkMode;

    return (
        <form onSubmit={onSubmit} className="flex gap-2">
            <input
                className={`border px-3 py-2 rounded-xl flex-1 text-sm font-mono tracking-wider transition-all outline-none
                    focus:ring-2 ${dm
                        ? "bg-[#0d1117] border-[#30363d] text-gray-200 placeholder-gray-600 focus:ring-blue-500/40 focus:border-blue-500/60"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-blue-300 focus:border-blue-400"}`}
                placeholder="Enter session code..."
                value={inputCode.toUpperCase()}
                onChange={(e) => setInputCode(e.target.value)}
            />
            <button
                type="submit"
                disabled={isLoading}
                className={`font-semibold text-sm px-5 py-2 rounded-xl transition-all hover:scale-[102%] active:scale-95 shadow-sm
                    flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none
                    ${dm
                        ? "bg-emerald-500 hover:bg-emerald-400 text-gray-900"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
            >
                {isLoading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {isLoading ? "Joining..." : "Join"}
            </button>
        </form>
    );
}
