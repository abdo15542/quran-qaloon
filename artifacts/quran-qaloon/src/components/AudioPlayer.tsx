import { useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, RotateCcw, RefreshCw } from "lucide-react";
import { useAudio } from "@/hooks/useAudio";

interface AudioPlayerProps {
  surahNumber: number;
  surahName: string;
  reciterName: string;
  audioUrl: string;
  initialTime?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onFinished?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  surahNumber,
  surahName,
  reciterName,
  audioUrl,
  initialTime = 0,
  onProgress,
  onFinished,
  onPrevious,
  onNext,
  hasPrevious = true,
  hasNext = true,
}: AudioPlayerProps) {
  const [retryKey, setRetryKey] = useState(0);
  const urlWithRetry = audioUrl;

  const { state, toggle, seek, setVolume, setPlaybackRate } = useAudio(
    urlWithRetry,
    initialTime,
    onProgress,
    onFinished,
    retryKey
  );
  const progressRef = useRef<HTMLInputElement>(null);

  const rates = [0.75, 1, 1.25, 1.5];
  const currentRateIndex = rates.indexOf(state.playbackRate);
  const nextRate = rates[(currentRateIndex + 1) % rates.length];

  const progress =
    state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const hasResume = initialTime > 0 && state.currentTime < 5;

  const handleRetry = () => {
    setRetryKey((k) => k + 1);
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
      <div className="geometric-pattern bg-primary/5 px-6 py-5 text-center">
        <div className="text-xs text-muted-foreground mb-1 truncate">{reciterName}</div>
        <div className="text-2xl font-arabic text-primary mb-1">{surahName}</div>
        <div className="text-xs text-muted-foreground">سورة رقم {surahNumber}</div>
      </div>

      <div className="px-6 py-4">
        {state.error && (
          <div className="mb-3 bg-destructive/10 rounded-xl px-3 py-3 text-center">
            <div className="text-sm text-destructive mb-2">
              تعذّر تحميل الملف الصوتي
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              قد يكون الخادم مؤقتاً غير متاح أو رابط الصوت غير صحيح
            </div>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              إعادة المحاولة
            </button>
          </div>
        )}

        {hasResume && !state.error && (
          <div className="flex items-center justify-between mb-3 bg-primary/8 rounded-xl px-3 py-2 border border-primary/20">
            <span className="text-xs text-primary font-arabic">
              متابعة من {formatTime(initialTime)}
            </span>
            <button
              onClick={() => seek(0)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 underline"
            >
              من البداية
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
            {formatTime(state.currentTime)}
          </span>
          <div className="flex-1 relative">
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <input
              ref={progressRef}
              type="range"
              min={0}
              max={state.duration || 100}
              value={state.currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
            {formatTime(state.duration)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setVolume(state.volume === 0 ? 1 : 0)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              {state.volume === 0 ? (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 h-1 accent-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-30"
              title="السورة السابقة"
            >
              <SkipForward className="w-5 h-5 text-foreground" />
            </button>

            <button
              onClick={toggle}
              disabled={state.isLoading}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                state.isPlaying
                  ? "bg-primary text-primary-foreground playing-pulse"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              } disabled:opacity-50`}
            >
              {state.isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : state.isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 mr-[-2px]" />
              )}
            </button>

            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-30"
              title="السورة التالية"
            >
              <SkipBack className="w-5 h-5 text-foreground" />
            </button>
          </div>

          <button
            onClick={() => setPlaybackRate(nextRate)}
            className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-xs font-sans text-muted-foreground transition-colors min-w-[44px] text-center"
          >
            {state.playbackRate}x
          </button>
        </div>

        <div className="mt-3 flex justify-center">
          <button
            onClick={() => seek(0)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>إعادة من البداية</span>
          </button>
        </div>
      </div>
    </div>
  );
}
