import { useState } from "react";
import { Download, Trash2, CheckCircle2, Loader2, WifiOff, AlertCircle } from "lucide-react";
import { useOffline } from "@/context/OfflineContext";

interface DownloadButtonProps {
  surahNumber: number;
  surahName: string;
  reciterId: string;
  reciterName: string;
  audioUrl: string;
  compact?: boolean;
}

export default function DownloadButton({
  surahNumber,
  surahName,
  reciterId,
  reciterName,
  audioUrl,
  compact = false,
}: DownloadButtonProps) {
  const { isCached, downloadAudio, deleteAudio, getDownloadProgress } = useOffline();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const cached = isCached(surahNumber, reciterId);
  const progress = getDownloadProgress(surahNumber, reciterId);
  const isDownloading = progress?.status === "downloading";
  const hasError = progress?.status === "error";

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDownloading) return;
    downloadAudio(surahNumber, surahName, reciterId, reciterName, audioUrl);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showDeleteConfirm) {
      deleteAudio(surahNumber, reciterId);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  if (isDownloading) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className={`flex items-center gap-1 text-primary transition-colors ${compact ? "p-1.5" : "px-2 py-1.5 rounded-lg bg-primary/10"}`}
        title={`جارٍ التحميل ${progress?.progress ?? 0}٪`}
      >
        <Loader2 className={`animate-spin flex-shrink-0 ${compact ? "w-3.5 h-3.5" : "w-3.5 h-3.5"}`} />
        {!compact && (
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs">{progress?.progress ?? 0}٪</span>
            <div className="w-12 h-0.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress?.progress ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </button>
    );
  }

  if (cached) {
    return (
      <button
        onClick={handleDelete}
        className={`flex items-center gap-1 transition-colors ${
          showDeleteConfirm
            ? "text-destructive"
            : "text-emerald-600 dark:text-emerald-400 hover:text-destructive"
        } ${compact ? "p-1.5" : "px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 hover:bg-destructive/10"}`}
        title={showDeleteConfirm ? "اضغط مرة أخرى للحذف" : "محفوظ للاستماع بدون إنترنت — اضغط لحذفه"}
      >
        {showDeleteConfirm ? (
          <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        {!compact && (
          <span className="text-xs">
            {showDeleteConfirm ? "تأكيد الحذف" : "محفوظ"}
          </span>
        )}
      </button>
    );
  }

  if (hasError) {
    return (
      <button
        onClick={handleDownload}
        className={`flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors ${compact ? "p-1.5" : "px-2 py-1.5 rounded-lg bg-destructive/10"}`}
        title="فشل التحميل — اضغط لإعادة المحاولة"
      >
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        {!compact && <span className="text-xs">إعادة</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      className={`flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors ${compact ? "p-1.5" : "px-2 py-1.5 rounded-lg hover:bg-primary/10"}`}
      title="تحميل للاستماع بدون إنترنت"
    >
      <Download className="w-3.5 h-3.5 flex-shrink-0" />
      {!compact && <span className="text-xs">تحميل</span>}
    </button>
  );
}
