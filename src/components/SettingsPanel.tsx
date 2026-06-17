import type { MotionSettings, ReadingDirection, Genre } from "../types";

interface Props {
  settings: MotionSettings;
  onChange: (patch: Partial<MotionSettings>) => void;
  onClose: () => void;
}

const GENRES: Genre[] = ["neutral", "action", "romance", "horror"];

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  return (
    <div className="absolute right-4 top-4 z-40 w-72 rounded-2xl border border-white/10 bg-zinc-900/85 p-4 shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-white/90">
          Cinematic Settings
        </h2>
        <button
          onClick={onClose}
          className="rounded-md px-2 text-white/50 hover:text-white"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      <Toggle
        label="Reduce motion"
        hint="Accessibility: instant cuts"
        value={settings.reduceMotion}
        onChange={(v) => onChange({ reduceMotion: v })}
      />

      <Slider
        label="Animation intensity"
        value={settings.intensity}
        onChange={(v) => onChange({ intensity: v })}
      />

      <Slider
        label="Dim non-active"
        value={settings.dim}
        onChange={(v) => onChange({ dim: v })}
      />

      <Toggle
        label="Parallax depth"
        hint="Pointer drives subtle camera drift"
        value={settings.parallax}
        onChange={(v) => onChange({ parallax: v })}
      />

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-white/60">Reading direction</p>
        <div className="grid grid-cols-2 gap-2">
          {(["ltr", "rtl"] as ReadingDirection[]).map((d) => (
            <button
              key={d}
              onClick={() => onChange({ direction: d })}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                settings.direction === d
                  ? "bg-orange-800 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {d === "ltr" ? "Left → Right" : "Right → Left (manga)"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-white/60">Genre effects</p>
        <div className="grid grid-cols-2 gap-2">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => onChange({ genre: g })}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition ${
                settings.genre === g
                  ? "bg-orange-800 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="mb-3 flex w-full items-center justify-between text-left"
    >
      <span>
        <span className="block text-xs font-medium text-white/80">{label}</span>
        {hint && <span className="block text-[10px] text-white/40">{hint}</span>}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          value ? "bg-orange-800" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            value ? "left-4" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 flex justify-between text-xs font-medium text-white/80">
        {label}
        <span className="text-white/40">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </label>
  );
}
