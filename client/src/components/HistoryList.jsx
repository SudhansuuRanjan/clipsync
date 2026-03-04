import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Edit, FileImage, Paperclip, Search, Trash2, Trash2Icon } from "lucide-react";
import { convertLinksToAnchor, plainTextPreview } from "../utils";

const PAGE_SIZE = 10;

function HistoryItem({ item, isDarkMode, isExpanded, onToggle, onEdit, onCopy, onDelete }) {
    const dm = isDarkMode;

    return (
        <li className={`flex flex-col relative gap-1 p-3 pb-2 rounded-xl transition-all
            ${dm
                ? "bg-[#0d1117] border border-[#30363d] hover:border-[#3d4d5e]"
                : "bg-gray-50 border border-gray-100 hover:border-gray-200"}`}>

            {/* Top row: expand + text (full width) */}
            <div className="flex gap-2 items-start w-full min-w-0">
                <button
                    aria-label="Expand Content"
                    className={`mt-0.5 shrink-0 transition-colors ${dm ? "text-blue-400" : "text-blue-500"}`}
                    onClick={onToggle}
                >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="flex flex-col flex-1 min-w-0">
                    <p
                        onClick={onToggle}
                        className={`text-sm cursor-pointer word-wrap link-wrap leading-relaxed break-words
                            ${isExpanded ? "" : "line-clamp-2"}
                            ${dm ? "text-gray-300" : "text-gray-600"}`}
                        dangerouslySetInnerHTML={{
                            __html: isExpanded
                                ? convertLinksToAnchor(item.content, item)
                                : item.sensitive
                                    ? "**********************"
                                    : plainTextPreview(item.content, 160),
                        }}
                    />

                    {item.file && (
                        <div className={`inline-flex items-center gap-1.5 mt-2 border text-xs rounded-lg px-2 py-1 w-fit
                            ${dm ? "border-[#30363d] bg-[#1e2530] text-gray-400" : "border-gray-200 bg-gray-100 text-gray-500"}`}>
                            {item.file.type === "file"
                                ? <Paperclip size={12} className="text-emerald-500" />
                                : <FileImage size={12} className="text-rose-500" />}
                            <a
                                href={item.fileUrl}
                                className="text-blue-400 hover:underline truncate max-w-[200px]"
                                target="_blank"
                                rel="noreferrer"
                            >
                                {item.file.path.length > 34
                                    ? item.file.path.substring(6, 10) + "..." + item.file.path.substring(item.file.path.length - 7)
                                    : item.file.path.substring(6)}
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom row: timestamp left, actions right */}
            <div className="flex items-center justify-between mt-1 pl-6">
                <p className={`text-[10px] ${dm ? "text-gray-600" : "text-gray-400"}`}>
                    {new Date(item.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true, month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-1">
                    {/* Copy first = most prominent */}
                    <button
                        aria-label="Copy Content"
                        title="Copy"
                        className={`p-1.5 rounded-lg transition-all active:scale-95
                            ${dm ? "text-blue-400 hover:bg-blue-500/10" : "text-blue-600 hover:bg-blue-50"}`}
                        onClick={onCopy}
                    >
                        <Copy size={15} />
                    </button>
                    <button
                        aria-label="Edit Clipboard"
                        title="Edit"
                        className={`p-1.5 rounded-lg transition-all active:scale-95
                            ${dm ? "text-emerald-400 hover:bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-50"}`}
                        onClick={onEdit}
                    >
                        <Edit size={15} />
                    </button>
                    <button
                        aria-label="Delete Item"
                        title="Delete"
                        className={`p-1.5 rounded-lg transition-all active:scale-95
                            ${dm ? "text-red-400 hover:bg-red-500/10" : "text-red-500 hover:bg-red-50"}`}
                        onClick={onDelete}
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </li>
    );
}

export default function HistoryList({ history, isDarkMode, isLoading, onEdit, onCopy, onDelete, onDeleteAll }) {
    const dm = isDarkMode;

    const [searchKeyword, setSearchKeyword] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const listEndRef = useRef(null);
    const observerRef = useRef(null);

    useEffect(() => {
        setSearchResults(history);
        setVisibleCount(PAGE_SIZE);
    }, [history]);

    const handleSearch = (e) => {
        const val = e.target.value;
        setSearchKeyword(val);
        setVisibleCount(PAGE_SIZE);
        if (!val.trim()) {
            setSearchResults(history);
            return;
        }
        setSearchResults(history.filter((item) =>
            item.content.toLowerCase().includes(val.toLowerCase())
        ));
    };

    const loadMore = useCallback(() => {
        setIsLoadingMore(true);
        setTimeout(() => {
            setVisibleCount((prev) => prev + PAGE_SIZE);
            setIsLoadingMore(false);
        }, 300);
    }, []);

    useEffect(() => {
        observerRef.current?.disconnect();
        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < searchResults.length) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );
        if (listEndRef.current) observerRef.current.observe(listEndRef.current);
        return () => observerRef.current?.disconnect();
    }, [visibleCount, searchResults.length, loadMore]);

    const visibleResults = searchResults.slice(0, visibleCount);

    if (isLoading) {
        return (
            <div className={`max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full shadow-xl rounded-2xl md:p-7 p-4 mt-5
                ${dm ? "bg-[#161b22] border border-[#30363d]" : "bg-white border border-gray-200/80"}`}>
                <div className={`h-5 w-36 rounded-lg mb-1 animate-pulse ${dm ? "bg-gray-800" : "bg-gray-200"}`} />
                <div className={`h-3 w-16 rounded mb-5 animate-pulse ${dm ? "bg-gray-800" : "bg-gray-200"}`} />
                <div className={`h-9 w-full rounded-xl mb-5 animate-pulse ${dm ? "bg-gray-800" : "bg-gray-200"}`} />
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-16 w-full rounded-xl animate-pulse ${dm ? "bg-gray-800" : "bg-gray-100"}`} />
                    ))}
                </div>
            </div>
        );
    }

    if (history.length === 0) return null;

    return (
        <div className={`max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full shadow-xl rounded-2xl md:p-7 p-4 mt-5
            ${dm ? "bg-[#161b22] border border-[#30363d]" : "bg-white border border-gray-200/80"}`}>

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className={`text-base font-bold ${dm ? "text-gray-200" : "text-gray-800"}`}>
                        Clipboard History
                    </h2>
                    <p className={`text-xs mt-0.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>
                        {searchResults.length} {searchResults.length === 1 ? "item" : "items"}
                        {searchKeyword && ` matching "${searchKeyword}"`}
                    </p>
                </div>
                <button
                    aria-label="Delete All Clipboards"
                    title="Clear All"
                    className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all
                        ${dm ? "text-red-400 hover:bg-red-500/10 border border-red-500/20" : "text-red-500 hover:bg-red-50 border border-red-200"}`}
                    onClick={onDeleteAll}
                >
                    <Trash2Icon size={14} /> Clear All
                </button>
            </div>

            {/* Search */}
            <div className="mb-4 w-full relative">
                <input
                    className={`border w-full pl-9 pr-3 py-2 rounded-xl text-sm transition-all outline-none
                        focus:ring-2 ${dm
                            ? "bg-[#0d1117] border-[#30363d] text-gray-200 placeholder-gray-600 focus:ring-blue-500/40 focus:border-blue-500/60"
                            : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-blue-300 focus:border-blue-400"}`}
                    placeholder="Search clipboard history..."
                    value={searchKeyword}
                    onChange={handleSearch}
                    type="search"
                    name="search_keywords"
                    id="search_keyword"
                />
                <Search size={15} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
            </div>

            {/* List */}
            <ul className="space-y-2">
                {visibleResults.map((item) => (
                    <HistoryItem
                        key={item.id}
                        item={item}
                        isDarkMode={isDarkMode}
                        isExpanded={expandedId === item.id}
                        onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        onEdit={() => onEdit(item.id)}
                        onCopy={() => onCopy(item.content)}
                        onDelete={() => onDelete(item.id)}
                    />
                ))}
            </ul>

            {/* Infinite scroll sentinel */}
            {visibleCount < searchResults.length && (
                <div ref={listEndRef} className="flex justify-center items-center py-4">
                    {isLoadingMore ? (
                        <div className={`flex items-center gap-2 text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Loading more...
                        </div>
                    ) : (
                        <div className={`text-xs ${dm ? "text-gray-600" : "text-gray-400"}`}>Scroll to load more</div>
                    )}
                </div>
            )}

            {visibleCount >= searchResults.length && searchResults.length > PAGE_SIZE && (
                <p className={`text-center text-xs mt-3 ${dm ? "text-gray-600" : "text-gray-400"}`}>
                    All {searchResults.length} items loaded
                </p>
            )}
        </div>
    );
}
