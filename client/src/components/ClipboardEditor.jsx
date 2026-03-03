import { ClipboardList, FileImage, FileUp, Paperclip, Send, Trash2 } from "lucide-react";
import supabase from "../config/supabase";
import toast from "react-hot-toast";

export default function ClipboardEditor({
    clipboard,
    setClipboard,
    isSensitive,
    setIsSensitive,
    fileUrl,
    setFileUrl,
    isDarkMode,
    textareaRef,
    onUploadFile,
    onSend,
    onPaste,
}) {
    const dm = isDarkMode;

    const pillClass = `flex w-fit items-center gap-1.5 cursor-pointer text-xs font-medium border
        hover:scale-[102%] active:scale-95 transition-all py-1.5 px-3 rounded-full
        ${dm ? "bg-[#1e2530] border-[#30363d] text-gray-300 hover:bg-[#252d3a]" : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"}`;

    const inputClass = `border p-3 w-full rounded-xl text-sm transition-all outline-none resize-none
        focus:ring-2 ${dm
            ? "bg-[#0d1117] border-[#30363d] text-gray-200 placeholder-gray-600 focus:ring-blue-500/40 focus:border-blue-500/60"
            : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-blue-300 focus:border-blue-400"}`;

    const handleClearFile = () => {
        if (fileUrl) supabase.storage.from("clipboard").remove([fileUrl.name]);
        setFileUrl(null);
        toast.success("File removed successfully!");
    };

    const handleClear = () => {
        setClipboard("");
        if (fileUrl) supabase.storage.from("clipboard").remove([fileUrl.name]);
        setFileUrl(null);
        toast.success("Clipboard cleared successfully!");
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Textarea */}
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    rows={6}
                    className={inputClass}
                    placeholder="Type or paste clipboard content here..."
                    value={clipboard}
                    onChange={(e) => {
                        setClipboard(e.target.value);
                        sessionStorage.setItem("clipboard", e.target.value);
                    }}
                />
                <label
                    className={`flex absolute items-center gap-1.5 cursor-pointer text-xs right-3 bottom-3 z-10
                        ${dm ? "text-gray-500" : "text-gray-400"}`}
                    htmlFor="is-sensitive"
                >
                    <input
                        checked={isSensitive}
                        onChange={(e) => setIsSensitive(e.target.checked)}
                        type="checkbox"
                        id="is-sensitive"
                        className="accent-blue-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    Sensitive
                </label>
            </div>

            {/* File attachment buttons */}
            <div className="flex flex-wrap gap-1.5">
                <input
                    type="file"
                    className="hidden"
                    id="attachfile"
                    accept="application/msword, application/vnd.ms-excel, application/vnd.ms-powerpoint, text/plain, application/pdf, image/*"
                    onChange={async (e) => {
                        await onUploadFile(e.target.files[0]);
                        e.target.value = null;
                    }}
                />
                <label htmlFor="attachfile" className={pillClass}>
                    <Paperclip className="text-emerald-500" size={14} /> Attach File
                </label>

                <input
                    type="file"
                    className="hidden"
                    id="attachimage"
                    accept="image/*"
                    onChange={async (e) => {
                        await onUploadFile(e.target.files[0], "image");
                        e.target.value = null;
                    }}
                />
                <label htmlFor="attachimage" className={pillClass}>
                    <FileImage className="text-rose-500" size={14} /> Attach Image
                </label>

                <input
                    type="file"
                    className="hidden"
                    id="importtxt"
                    accept=".txt"
                    onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setClipboard(reader.result);
                        reader.readAsText(file);
                        toast.success("File selected successfully!");
                        e.target.value = null;
                    }}
                />
                <label htmlFor="importtxt" className={`hidden md:flex ${pillClass}`}>
                    <FileUp className="text-blue-500" size={14} /> Import Text File
                </label>
            </div>

            {/* File preview */}
            {fileUrl && (
                <div className={`flex gap-2 items-center p-2 py-2 rounded-xl text-sm
                    ${dm ? "bg-[#1e2530] border border-[#30363d]" : "bg-gray-100 border border-gray-200"}`}>
                    <FileUp size={16} className="text-blue-500 shrink-0" />
                    <p className={`flex-1 truncate ${dm ? "text-gray-300" : "text-gray-700"}`}>{fileUrl.path}</p>
                    <button className="text-red-400 hover:text-red-500 active:scale-95 transition" onClick={handleClearFile}>
                        <Trash2 size={16} />
                    </button>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
                <button
                    className={`flex-1 min-w-28 flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl transition-all hover:scale-[102%] active:scale-95 shadow-sm
                        ${dm ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20" : "bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"}`}
                    onClick={onPaste}
                >
                    <ClipboardList size={16} /> Paste Text
                </button>
                <button
                    className={`flex-1 min-w-28 flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl transition-all hover:scale-[102%] active:scale-95 shadow-sm
                        ${dm ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20" : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"}`}
                    onClick={handleClear}
                >
                    <Trash2 size={16} /> Clear
                </button>
                <button
                    className={`flex-1 min-w-40 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-all hover:scale-[102%] active:scale-95 shadow-sm
                        ${dm ? "bg-emerald-500 hover:bg-emerald-400 text-gray-900" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
                    onClick={onSend}
                >
                    <Send size={16} /> Send to Clipboard
                </button>
            </div>
        </div>
    );
}
