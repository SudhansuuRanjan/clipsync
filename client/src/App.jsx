import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import "./App.css";

import {
    createSession,
    createEntry,
    deleteEntry,
    clearEntries,
    listEntries,
    verifySession,
    uploadFiles,
    claimPair,
    getStats,
    trackStats,
    openRealtimeSocket,
} from "./service/api";
import { compressImage } from "./compressedFileUpload";

import TopBar from "./components/TopBar";
import SessionBadge from "./components/SessionBadge";
import JoinSessionForm from "./components/JoinSessionForm";
import ClipboardEditor from "./components/ClipboardEditor";
import HistoryList from "./components/HistoryList";
import QrDock from "./components/QrDock";

const MAX_TEXT = 15000;
const MAX_FILE = 15 * 1024 * 1024;

export default function App() {
    const [sessionCode, setSessionCode] = useState("");
    const [inputCode, setInputCode] = useState("");
    const [clipboard, setClipboard] = useState(sessionStorage.getItem("clipboard") || "");
    const [isSensitive, setIsSensitive] = useState(false);
    const [history, setHistory] = useState([]);
    const [files, setFiles] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
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
    const fetchHistory = async (code) => {
        if (!code) return;
        setIsHistoryLoading(true);
        try {
            const data = await listEntries(code);
            setHistory(data || []);
        } catch {
            toast.error("Failed to fetch clipboard history.");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    useEffect(() => {
        const handleOnline = () => { setIsOffline(false); setTimeout(() => fetchHistory(sessionCode), 100); };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [sessionCode]);

    // ─── Restore session on mount ────────────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem("sessionCode");
        if (stored) setSessionCode(stored.toUpperCase());
    }, []);

    // ─── Mobile handoff (QR pair code) ───────────────────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pair = params.get("pair");
        if (!pair) return;

        (async () => {
            const stripPair = () => history.replaceState({}, "", window.location.pathname);
            try {
                const { sessionCode: incoming } = await claimPair(pair);
                stripPair();

                const local = localStorage.getItem("sessionCode");
                if (local && local.toUpperCase() === incoming.toUpperCase()) {
                    if (!sessionCode) setSessionCode(incoming.toUpperCase());
                    return;
                }
                if (local) {
                    const ok = confirm(
                        `You are currently in session ${local.toUpperCase()}. Switch to incoming session ${incoming.toUpperCase()}?`
                    );
                    if (!ok) return;
                }

                const exists = await verifySession(incoming);
                if (!exists) {
                    toast.error("Pairing target session no longer exists.");
                    return;
                }

                localStorage.setItem("sessionCode", incoming);
                setSessionCode(incoming.toUpperCase());
                setInputCode("");
                setHistory([]);
                setClipboard("");
                setFiles([]);
                setIsSensitive(false);
                sessionStorage.removeItem("clipboard");
                toast.success(`Switched to session ${incoming.toUpperCase()}`);
            } catch {
                stripPair();
                toast.error("Pairing code expired or invalid.");
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Fetch history whenever session code is set ──────────────────────────────
    useEffect(() => {
        if (!sessionCode) return;
        fetchHistory(sessionCode);
    }, [sessionCode]);

    // ─── Real-time subscription (Workers WebSocket) ──────────────────────────────
    useEffect(() => {
        if (!sessionCode) return;
        const close = openRealtimeSocket(sessionCode, (event) => {
            if (event.type === "entry:new") {
                setHistory((prev) => [event.entry, ...prev.filter((e) => e.id !== event.entry.id)]);
                if (isSendingRef.current) {
                    setClipboard("");
                    setFiles([]);
                    setIsSensitive(false);
                    sessionStorage.removeItem("clipboard");
                    isSendingRef.current = false;
                }
            } else if (event.type === "entry:delete") {
                setHistory((prev) => prev.filter((e) => e.id !== event.id));
            } else if (event.type === "entries:clear") {
                setHistory([]);
            }
        });
        return close;
    }, [sessionCode]);

    // ─── Session join ────────────────────────────────────────────────────────────
    const joinSession = async () => {
        if (!inputCode.trim()) return toast.error("Please enter a session code");

        setIsJoining(true);
        const toastId = toast.loading("Checking session...");

        try {
            const exists = await verifySession(inputCode.trim().toUpperCase());
            if (!exists) {
                toast.error("Session code not found. Please enter a valid code.", { id: toastId });
                return;
            }

            const code = inputCode.trim().toUpperCase();
            setSessionCode(code);
            localStorage.setItem("sessionCode", code);

            toast.loading("Fetching clipboard history...", { id: toastId });
            const data = await listEntries(code);
            toast.success(`Joined session ${code}!`, { id: toastId });
            setInputCode("");
            setClipboard("");
            setHistory(data);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to join session.", { id: toastId });
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeaveSession = () => {
        const ans = confirm("Are you sure you want to leave the session?");
        if (!ans) return;
        setSessionCode("");
        localStorage.removeItem("sessionCode");
        sessionStorage.removeItem("clipboard");
        setHistory([]);
        setClipboard("");
        setFiles([]);
    };

    // ─── File upload ─────────────────────────────────────────────────────────────
    const uploadFileHandler = async (file, type = "file") => {
        if (!file) return toast.error("Please select a file to upload");
        if (file.size > MAX_FILE) return toast.error("File size exceeds 15MB. Please upload a smaller file.");

        const toastId = toast.loading("Uploading file...");

        if (type === "image" || file.type.startsWith("image/")) {
            try { file = await compressImage(file); }
            catch { return toast.error("An error occurred while compressing image", { id: toastId }); }
        }

        try {
            const [attachment] = await uploadFiles([file]);
            setFiles((prev) => [...prev, attachment]);
            toast.success("File uploaded successfully!", { id: toastId });
        } catch {
            toast.error("An error occurred while uploading file", { id: toastId });
        }
    };

    // ─── Send clipboard ───────────────────────────────────────────────────────────
    const updateClipboard = async () => {
        if (!clipboard && files.length === 0) return toast.error("Please enter some text to update clipboard");
        if (clipboard.length > MAX_TEXT) return toast.error(`Clipboard content is too long. Please keep it under ${MAX_TEXT} characters.`);

        setIsSending(true);
        const toastId = toast.loading("Sending to clipboard...");

        try {
            let code = sessionCode;
            if (!code) {
                code = await createSession();
                setSessionCode(code);
                localStorage.setItem("sessionCode", code);
            }

            isSendingRef.current = true;
            const entry = await createEntry(code, {
                content: clipboard,
                sensitive: isSensitive,
                files,
            });

            setHistory((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)]);
            setFiles([]);
            setClipboard("");
            sessionStorage.removeItem("clipboard");
            setIsSensitive(false);
            isSendingRef.current = false;
            toast.success("Sent!", { id: toastId });
        } catch (e) {
            isSendingRef.current = false;
            toast.error(e instanceof Error ? e.message : "Failed to send. Please try again.", { id: toastId });
        } finally {
            setIsSending(false);
        }
    };

    // ─── Paste from OS clipboard ──────────────────────────────────────────────────
    const pasteFromClipboard = () => {
        navigator.clipboard.readText()
            .then((text) => {
                if (text.trim()) { setClipboard(text); sessionStorage.setItem("clipboard", text); toast.success("Clipboard text pasted successfully!"); }
                else alert("Clipboard is empty or contains unsupported data.");
            })
            .catch(() => alert("An error occurred while reading clipboard"));
    };

    // ─── Edit history item ────────────────────────────────────────────────────────
    const handleEdit = (id) => {
        const toastId = toast.loading("Loading to editor...");
        const item = history.find((i) => i.id === id);
        if (!item) {
            toast.error("Item not found.", { id: toastId });
            return;
        }
        setClipboard(item.content);
        if (item.files && item.files.length > 0) {
            setFiles(item.files.map((f) => ({
                key: f.key,
                name: f.name,
                type: f.type,
                size: f.size,
                url: f.url,
            })));
        } else {
            setFiles([]);
        }
        setIsSensitive(item.sensitive);
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
            await deleteEntry(sessionCode, id);
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
            await clearEntries(sessionCode);
            setHistory([]);
            toast.success("Clipboard history cleared!", { id: toastId });
        } catch {
            toast.error("Failed to clear history.", { id: toastId });
        }
    };

    // ─── Visitor counter (Workers KV-backed, cookie-deduped) ─────────────────────
    useEffect(() => {
        (async () => {
            try {
                const stats = await trackStats();
                setTotalVisitor(stats.total);
                setUniqueVisitor(stats.unique);
            } catch {
                try {
                    const stats = await getStats();
                    setTotalVisitor(stats.total);
                    setUniqueVisitor(stats.unique);
                } catch {
                    // ignore
                }
            }
        })();
    }, []);

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
                    files={files}
                    setFiles={setFiles}
                    isDarkMode={isDarkMode}
                    textareaRef={textareaRef}
                    onUploadFile={uploadFileHandler}
                    onSend={updateClipboard}
                    onPaste={pasteFromClipboard}
                    isSending={isSending}
                />
            </div>

            <HistoryList
                history={history}
                isDarkMode={isDarkMode}
                isLoading={isHistoryLoading}
                onEdit={handleEdit}
                onCopy={copyToClipboard}
                onDelete={handleDeleteOne}
                onDeleteAll={deleteAll}
            />

            <QrDock sessionCode={sessionCode} isDarkMode={isDarkMode} />

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
