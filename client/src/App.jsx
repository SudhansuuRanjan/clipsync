import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import "./App.css";

import supabase from "./config/supabase";
import { createSession } from "./service/doc.service";
import { compressImage } from "./compressedFileUpload";

import TopBar from "./components/TopBar";
import SessionBadge from "./components/SessionBadge";
import JoinSessionForm from "./components/JoinSessionForm";
import ClipboardEditor from "./components/ClipboardEditor";
import HistoryList from "./components/HistoryList";

export default function App() {
    const [sessionCode, setSessionCode] = useState("");
    const [inputCode, setInputCode] = useState("");
    const [clipboard, setClipboard] = useState(sessionStorage.getItem("clipboard") || "");
    const [isSensitive, setIsSensitive] = useState(false);
    const [history, setHistory] = useState([]);
    const [deleteOne, setDeleteOne] = useState(false);
    const [fileUrl, setFileUrl] = useState(null);
    const [isJoining, setIsJoining] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [totalVisitor, setTotalVisitor] = useState(0);
    const [uniqueVisitor, setUniqueVisitor] = useState(0);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem("darkMode");
        return saved ? JSON.parse(saved) : window.matchMedia("(prefers-color-scheme: dark)").matches;
    });
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    const textareaRef = useRef(null);
    // True while THIS device is mid-insert so we can distinguish own vs remote sync
    const isSendingRef = useRef(false);

    const dm = isDarkMode;

    // ─── Dark mode ──────────────────────────────────────────────────────────────
    const toggleDarkMode = () => {
        setIsDarkMode((prev) => {
            const next = !prev;
            localStorage.setItem("darkMode", JSON.stringify(next));
            return next;
        });
    };

    // ─── Online / Offline ────────────────────────────────────────────────────────
    const fetchClipboardHistory = async () => {
        if (!sessionCode) return;
        const { data, error } = await supabase
            .from("clipboard")
            .select("*")
            .eq("session_code", sessionCode);
        if (!error) setHistory(data || []);
    };

    useEffect(() => {
        const handleOnline = () => { setIsOffline(false); setTimeout(fetchClipboardHistory, 100); };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // ─── Initial session restore ─────────────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem("sessionCode");
        if (stored) {
            setSessionCode(stored);
            (async () => {
                const { data, error } = await supabase
                    .from("clipboard")
                    .select("*")
                    .eq("session_code", stored.toUpperCase())
                    .order("created_at", { ascending: false });
                if (error) { toast.error("An error occurred while fetching clipboard history"); return; }
                setHistory(data);
            })();
        }
        console.clear();
    }, []);

    // ─── Real-time subscription ──────────────────────────────────────────────────
    useEffect(() => {
        if (!sessionCode) return;
        const channel = supabase
            .channel("clipboard")
            .on("postgres_changes", { event: "*", schema: "public", table: "clipboard" }, (payload) => {
                if (payload.new.session_code === sessionCode && payload.eventType === "INSERT") {
                    setHistory((prev) => [payload.new, ...prev]);
                    // Only clear the textarea when this device sent the update
                    if (isSendingRef.current) {
                        setClipboard("");
                        isSendingRef.current = false;
                    }
                }
                if (payload.eventType === "DELETE") {
                    if (deleteOne) {
                        setHistory([]);
                    } else {
                        setHistory((prev) => prev.filter((item) => item.id !== payload.old.id));
                    }
                }
            })
            .subscribe();
        console.clear();
        return () => supabase.removeChannel(channel);
    }, [sessionCode, isOffline]);

    // ─── Session join ────────────────────────────────────────────────────────────
    const joinSession = async () => {
        if (!inputCode.trim()) return toast.error("Please enter a session code");

        setIsJoining(true);
        const toastId = toast.loading("Checking session...");

        const { data: sessionData, error: sessionError } = await supabase
            .from("sessions").select("*").eq("code", inputCode.toUpperCase());

        if (sessionData.length === 0 || sessionError) {
            toast.error("Session code not found. Please enter a valid code.", { id: toastId });
            setIsJoining(false);
            return;
        }

        setSessionCode(inputCode.toUpperCase());
        localStorage.setItem("sessionCode", inputCode.toUpperCase());

        toast.loading("Fetching clipboard history...", { id: toastId });
        const { data, error } = await supabase
            .from("clipboard").select("*")
            .eq("session_code", inputCode.toUpperCase())
            .order("created_at", { ascending: false });

        if (error) {
            toast.error("Failed to fetch clipboard history.", { id: toastId });
            setIsJoining(false);
            return;
        }

        toast.success(`Joined session ${inputCode.toUpperCase()}!`, { id: toastId });
        setInputCode("");
        setClipboard("");
        setHistory(data);
        setIsJoining(false);
    };

    const handleLeaveSession = () => {
        const ans = confirm("Are you sure you want to leave the session?");
        if (!ans) return;
        setSessionCode("");
        localStorage.removeItem("sessionCode");
        sessionStorage.removeItem("clipboard");
        setHistory([]);
    };

    // ─── File upload ─────────────────────────────────────────────────────────────
    const uploadFile = async (file, type = "file") => {
        if (!file) return toast.error("Please select a file to upload");
        if (file.size > 10 * 1024 * 1024) return toast.error("File size exceeds 10MB. Please upload a smaller file.");

        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const random = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        const toastId = toast.loading("Uploading file...");

        if (file.type.includes("image")) {
            try { file = await compressImage(file); }
            catch { return toast.error("An error occurred while compressing image"); }
        }

        try {
            const { data, error } = await supabase.storage.from("clipboard").upload(`files/${random + file.name}`, file);
            if (error) throw error;
            const url = `https://qthpintkaihcmklahkwf.supabase.co/storage/v1/object/public/${data.fullPath}`;
            setFileUrl({ url, ...data, type });
            toast.success("File uploaded successfully!", { id: toastId });
        } catch {
            toast.error("An error occurred while uploading file", { id: toastId });
        }
    };

    // ─── Send clipboard ───────────────────────────────────────────────────────────
    const updateClipboard = async () => {
        if (!clipboard && !fileUrl) return toast.error("Please enter some text to update clipboard");
        if (clipboard.length > 15000) return toast.error("Clipboard content is too long. Please keep it under 15000 characters.");

        setIsSending(true);
        const toastId = toast.loading("Sending to clipboard...");

        try {
            let firstTime = false;
            if (!sessionCode) { await createSession(setSessionCode); firstTime = true; }

            isSendingRef.current = true;
            const code = localStorage.getItem("sessionCode");
            const { error } = await supabase.from("clipboard").insert([{
                session_code: code,
                content: clipboard,
                fileUrl: fileUrl ? fileUrl.url : null,
                file: fileUrl ? fileUrl : null,
                sensitive: isSensitive,
            }]);

            if (error) throw error;

            if (history.length === 0 && firstTime) {
                const { data, error: fetchError } = await supabase
                    .from("clipboard").select("*").eq("session_code", code).order("created_at", { ascending: false });
                if (!fetchError) setHistory(data);
            }

            setFileUrl(null);
            setClipboard("");
            sessionStorage.removeItem("clipboard");
            setIsSensitive(false);
            toast.success("Sent!", { id: toastId });
        } catch {
            isSendingRef.current = false;
            toast.error("Failed to send. Please try again.", { id: toastId });
        } finally {
            setIsSending(false);
        }
    };

    // ─── Paste from OS clipboard ──────────────────────────────────────────────────
    const pasteFromClipboard = () => {
        navigator.clipboard.readText()
            .then((text) => {
                if (text.trim()) { setClipboard(text); toast.success("Clipboard text pasted successfully!"); }
                else alert("Clipboard is empty or contains unsupported data.");
            })
            .catch(() => alert("An error occurred while reading clipboard"));
    };

    // ─── Edit history item ────────────────────────────────────────────────────────
    const handleEdit = async (id) => {
        const toastId = toast.loading("Loading to editor...");
        setDeleteOne(true);
        const item = history.find((i) => i.id === id);
        setClipboard(item.content);
        setFileUrl(item.file);
        setDeleteOne(false);
        toast.success("Ready to edit!", { id: toastId });
        setTimeout(() => {
            textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            textareaRef.current?.focus();
        }, 100);
    };

    const copyToClipboard = (content) => {
        navigator.clipboard.writeText(content);
        toast.success("Text copied to clipboard!");
    };

    // ─── Delete one ───────────────────────────────────────────────────────────────
    const handleDeleteOne = async (id) => {
        const toastId = toast.loading("Deleting...");
        try {
            const item = history.find((i) => i.id === id);
            if (item?.file) await supabase.storage.from("clipboard").remove([item.file.name]);
            const { error } = await supabase.from("clipboard").delete().eq("id", id);
            if (error) throw error;
            setHistory((prev) => prev.filter((i) => i.id !== id));
            toast.success("Deleted!", { id: toastId });
        } catch {
            toast.error("Failed to delete.", { id: toastId });
        }
    };

    // ─── Delete all ───────────────────────────────────────────────────────────────
    const deleteAll = async () => {
        if (!confirm("Are you sure you want to clear clipboards?")) return;
        if (history.length === 0) return toast.error("No items in your clipboard history");
        const toastId = toast.loading("Clearing all items...");
        try {
            history.forEach(async (item) => {
                if (item.file) await supabase.storage.from("clipboard").remove([item.file.name]);
            });
            const { error } = await supabase.from("clipboard").delete().eq("session_code", sessionCode);
            if (error) throw error;
            setHistory([]);
            toast.success("Clipboard history cleared!", { id: toastId });
        } catch {
            toast.error("Failed to clear history.", { id: toastId });
        }
    };

    // ─── Visitor counter ──────────────────────────────────────────────────────────
    const getCounter = async () => {
        const { data, error } = await supabase.from("counter").select("*");
        if (error) return console.log(error);
        setTotalVisitor(data[0].total);
        setUniqueVisitor(data[0].unique);
        return data;
    };

    const updateDocument = async (collection, id, data) => {
        const { data: updated, error } = await supabase.from(collection).update(data).eq("id", id).select("*");
        if (error) return console.log(error);
        return updated;
    };

    const getVisitedCookie = () => document.cookie.split(";").some((c) => c.includes("visited"));

    const setVisitedCookie = () => {
        const date = new Date();
        date.setTime(date.getTime() + 30 * 24 * 60 * 60 * 1000);
        document.cookie = `visited=true; path=/; expires=${date.toUTCString()}; sameSite=strict; secure`;
    };

    const updateCounter = async () => {
        try {
            const res = await getCounter();
            if (!res?.[0]) return true;
            const visited = getVisitedCookie();
            const data = visited
                ? { unique: res[0].unique, total: res[0].total + 1 }
                : { unique: res[0].unique + 1, total: res[0].total + 1 };
            if (!visited) setVisitedCookie();
            await updateDocument("counter", 1, data);
        } catch { /* silent */ }
        return true;
    };

    useQuery({
        queryKey: ["counter"],
        queryFn: updateCounter,
        enabled: true,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 2,
        refetchInterval: 1000 * 60 * 5,
    });

    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
        <div className={`flex relative flex-col items-center min-h-screen md:p-6 p-3 md:pt-16 pt-16
            ${dm ? "bg-[#0d1117] text-gray-200" : "bg-gradient-to-br from-slate-100 via-gray-100 to-blue-50 text-gray-900"}`}>
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: dm ? "#1e2530" : "#fff",
                        color: dm ? "#e2e8f0" : "#1a202c",
                        border: dm ? "1px solid #2d3748" : "1px solid #e2e8f0",
                        borderRadius: "12px",
                        boxShadow: dm ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.08)",
                    },
                }}
            />

            <TopBar
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
                uniqueVisitor={uniqueVisitor}
                totalVisitor={totalVisitor}
            />

            {/* Main Card */}
            <div className={`max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full shadow-xl rounded-2xl md:p-7 p-4 space-y-5
                ${dm ? "bg-[#161b22] border border-[#30363d]" : "bg-white border border-gray-200/80"}`}>

                {/* Header */}
                <div className="text-center space-y-1">
                    <h1 className={`md:text-3xl text-2xl font-extrabold tracking-tight
                        ${dm
                            ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400"
                            : "text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500"}`}>
                        Clipboard Sync
                    </h1>
                    <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>
                        Sync clipboard content seamlessly across devices
                    </p>
                </div>

                {/* Offline banner */}
                {isOffline && (
                    <div className="flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                        You are offline. Please reconnect to sync clipboard content.
                    </div>
                )}

                <SessionBadge
                    sessionCode={sessionCode}
                    isDarkMode={isDarkMode}
                    onLeave={handleLeaveSession}
                />

                <JoinSessionForm
                    inputCode={inputCode}
                    setInputCode={setInputCode}
                    onSubmit={async (e) => { e.preventDefault(); await joinSession(); }}
                    isDarkMode={isDarkMode}
                    isLoading={isJoining}
                />

                <ClipboardEditor
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    isSensitive={isSensitive}
                    setIsSensitive={setIsSensitive}
                    fileUrl={fileUrl}
                    setFileUrl={setFileUrl}
                    isDarkMode={isDarkMode}
                    textareaRef={textareaRef}
                    onUploadFile={uploadFile}
                    onSend={updateClipboard}
                    onPaste={pasteFromClipboard}
                    isSending={isSending}
                />
            </div>

            <HistoryList
                history={history}
                isDarkMode={isDarkMode}
                onEdit={handleEdit}
                onCopy={copyToClipboard}
                onDelete={handleDeleteOne}
                onDeleteAll={deleteAll}
            />

            {/* Footer */}
            <footer className={`mt-6 text-center text-xs ${dm ? "text-gray-600" : "text-gray-400"}`}>
                Made with ❤️ by{" "}
                <a href="https://sudhanshur.vercel.app" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                    Sudhanshu Ranjan
                </a>
            </footer>
        </div>
    );
}
