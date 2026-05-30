import { useState } from "react";
import { Clock } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

function UnixTimeConverter() {
  const [input, setInput] = useState(() => Math.floor(Date.now() / 1000).toString());

  const seconds = Number(input);
  const valid = input.trim() !== "" && Number.isFinite(seconds);
  const date = valid ? new Date(seconds * 1000) : null;
  const ok = date !== null && !Number.isNaN(date.getTime());

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-lg font-semibold">Unix Time Converter</h1>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Unix time (seconds since epoch)"
          className="flex-1 rounded-md bg-neutral-800 px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={() => setInput(Math.floor(Date.now() / 1000).toString())}
          className="rounded-md bg-neutral-700 px-3 py-2 text-sm hover:bg-neutral-600"
        >
          Now
        </button>
      </div>
      {ok ? (
        <dl className="grid grid-cols-[8rem_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-neutral-400">Local</dt>
          <dd className="font-mono">{date!.toString()}</dd>
          <dt className="text-neutral-400">UTC (ISO 8601)</dt>
          <dd className="font-mono">{date!.toISOString()}</dd>
          <dt className="text-neutral-400">Relative</dt>
          <dd className="font-mono">{relative(date!)}</dd>
        </dl>
      ) : (
        <p className="text-sm text-red-400">Enter a valid Unix timestamp.</p>
      )}
    </div>
  );
}

function relative(date: Date): string {
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export const unixTimeTool: ToolDefinition = {
  id: "unix-time",
  name: "Unix Time Converter",
  description: "Convert UNIX timestamps to human-readable dates",
  category: "time",
  keywords: ["epoch", "timestamp", "date", "time", "iso", "utc"],
  icon: Clock,
  component: UnixTimeConverter,
};
