"use client";

import { Maximize, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

/** True when the URL is a real video file rather than a still. */
export function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

/**
 * Player for video generations. A real video file plays in a <video>; a motion
 * preview plays its CSS camera keyframes over the start frame. Both share one
 * control strip: play/pause, scrubber, time and fullscreen.
 */
export function PreviewPlayer({
  src,
  alt,
  duration,
  animation,
  ratio,
}: {
  src: string;
  alt: string;
  /** Seconds. A motion preview runs one keyframe pass per duration, looping. */
  duration: number;
  /** cssKeyframesName of the motion preset; ignored for real video files. */
  animation?: string;
  /** Width / height of the frame. */
  ratio: number;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(duration);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const real = isVideoFile(src);

  /** The running CSS animation on the still, if any (reduced motion removes it). */
  const motion = useCallback((): Animation | undefined => imageRef.current?.getAnimations()[0], []);

  // Motion previews have no media clock, so read the animation's on each frame.
  useEffect(() => {
    if (real) return;
    let raf = 0;
    const tick = () => {
      const current = Number(motion()?.currentTime ?? 0);
      setTime((current / 1000) % duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [real, duration, motion]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggle() {
    if (real) {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) void video.play();
      else video.pause();
      return;
    }
    const anim = motion();
    if (playing) anim?.pause();
    else anim?.play();
    setPlaying(!playing);
  }

  function seek(seconds: number) {
    if (real) {
      if (videoRef.current) videoRef.current.currentTime = seconds;
      return;
    }
    const anim = motion();
    if (anim) anim.currentTime = seconds * 1000;
    setTime(seconds);
  }

  function fullscreen() {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.requestFullscreen?.();
  }

  return (
    <div
      ref={frameRef}
      className={cn("relative overflow-hidden rounded-card bg-black", isFullscreen && "flex items-center justify-center")}
    >
      <div
        className={cn("relative mx-auto overflow-hidden", isFullscreen && "max-h-full max-w-full")}
        style={{
          aspectRatio: ratio,
          ...(isFullscreen ? { height: "100%" } : { width: `min(100%, calc(50dvh * ${ratio}))` }),
        }}
      >
        {real ? (
          <video
            ref={videoRef}
            src={src}
            className="size-full object-contain"
            autoPlay
            muted
            loop
            playsInline
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLength(e.currentTarget.duration)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            onClick={toggle}
            className="size-full object-cover"
            style={animation ? { animation: `${animation} ${duration}s ease-in-out infinite` } : undefined}
          />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6 text-xs text-text">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-7 items-center justify-center rounded-pill hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-text"
        >
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        <input
          type="range"
          min={0}
          max={length}
          step={0.05}
          value={Math.min(time, length)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="h-1 min-w-0 flex-1 cursor-pointer accent-lime"
        />
        <span className="tabular-nums text-text-muted">
          {formatClock(time)} / {formatClock(length)}
        </span>
        <button
          type="button"
          onClick={fullscreen}
          aria-label="Fullscreen"
          className="flex size-7 items-center justify-center rounded-pill hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-text"
        >
          <Maximize className="size-4" />
        </button>
      </div>
    </div>
  );
}
