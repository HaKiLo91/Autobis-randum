"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "running" | "done";
type Entry = { value: number; min: number; max: number; at: number };

const LIMIT = 1_000_000_000;
const STORAGE_KEY = "lucky-draw-history";

function formatTime(at: number): string {
  return new Date(at).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

// Số ngẫu nhiên an toàn (không bị lệch), dùng crypto của trình duyệt
function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  const cap = Math.floor(4294967296 / range) * range;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= cap);
  return min + (buf[0] % range);
}

function pickResult(min: number, max: number, used: Set<number>): number {
  const total = max - min + 1;
  if (total <= 100000) {
    const pool: number[] = [];
    for (let i = min; i <= max; i++) if (!used.has(i)) pool.push(i);
    return pool[randomInt(0, pool.length - 1)];
  }
  let n: number;
  do {
    n = randomInt(min, max);
  } while (used.has(n));
  return n;
}

function ballFontSize(text: string): string {
  const len = text.length;
  if (len <= 3) return "5.5rem";
  if (len <= 5) return "4.2rem";
  if (len <= 8) return "3rem";
  return "2.2rem";
}

export default function Home() {
  const [from, setFrom] = useState<string>("1");
  const [to, setTo] = useState<string>("100");
  const [seconds, setSeconds] = useState<number>(5);
  const [noRepeat, setNoRepeat] = useState<boolean>(true);
  const [status, setStatus] = useState<Status>("idle");
  const [shown, setShown] = useState<number | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Đọc lịch sử đã lưu khi mở trang
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw) as Entry[]);
    } catch {
      // bỏ qua nếu trình duyệt chặn localStorage
    }
    setReady(true);
  }, []);

  // Lưu lịch sử mỗi khi thay đổi (giữ tối đa 200 lượt)
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 200)));
    } catch {
      // bỏ qua
    }
  }, [history, ready]);

  function clearHistory(): void {
    setHistory([]);
    setShown(null);
    setStatus("idle");
  }

  async function copyHistory(): Promise<void> {
    const lines = [...history]
      .reverse()
      .map((e, i) => `${i + 1}. ${e.value} (${e.min} - ${e.max}) ${formatTime(e.at)}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Không sao chép được. Hãy cho phép trang truy cập clipboard.");
    }
  }

  function start(): void {
    const min = Number(from);
    const max = Number(to);

    if (from.trim() === "" || to.trim() === "" || !Number.isInteger(min) || !Number.isInteger(max)) {
      return setError("Hãy nhập số nguyên cho cả hai ô.");
    }
    if (Math.abs(min) > LIMIT || Math.abs(max) > LIMIT) {
      return setError("Giới hạn tối đa là 1.000.000.000.");
    }
    if (min >= max) {
      return setError("Số bắt đầu phải nhỏ hơn số kết thúc.");
    }

    const used = new Set<number>(
      noRepeat ? history.map((e) => e.value).filter((n) => n >= min && n <= max) : []
    );
    if (used.size >= max - min + 1) {
      return setError("Đã quay hết các số trong khoảng này. Hãy xóa lịch sử hoặc đổi khoảng số.");
    }

    setError("");
    setStatus("running");

    const result = pickResult(min, max, used);
    const startedAt = performance.now();
    const total = seconds * 1000;

    const tick = (): void => {
      const t = Math.min((performance.now() - startedAt) / total, 1);
      if (t >= 1) {
        setShown(result);
        setHistory((h) => [{ value: result, min, max, at: Date.now() }, ...h]);
        setStatus("done");
        return;
      }
      setShown(randomInt(min, max));
      // càng về cuối càng chậm lại
      timer.current = setTimeout(tick, 40 + t * t * 380);
    };
    tick();
  }

  const running = status === "running";
  const text = shown === null ? "?" : shown.toLocaleString("vi-VN");

  return (
    <main className="page">
      <header className="head">
        <h1>Quay số may mắn</h1>
        <p>Chọn khoảng số và thời gian quay, rồi bấm quay.</p>
      </header>

      <div className="layout">
        <section className="stage" aria-label="Kết quả quay số">
          <div className={`ball ${status}`}>
            <div className="face">
              <span className="num" style={{ fontSize: ballFontSize(text) }}>
                {text}
              </span>
            </div>
          </div>

          <p className="sr" aria-live="polite">
            {status === "done" ? `Kết quả: ${text}` : ""}
          </p>

          <button className="go" onClick={start} disabled={running}>
            {running ? "Đang quay..." : status === "done" ? "Quay tiếp" : "Quay số"}
          </button>
        </section>

        <section className="panel" aria-label="Cài đặt">
          <div className="row">
            <label>
              Từ số
              <input
                type="number"
                inputMode="numeric"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={running}
              />
            </label>
            <label>
              Đến số
              <input
                type="number"
                inputMode="numeric"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={running}
              />
            </label>
          </div>

          <label className="range">
            <span className="range-top">
              Thời gian quay <strong>{seconds} giây</strong>
            </span>
            <input
              type="range"
              min="1"
              max="30"
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value))}
              disabled={running}
            />
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={noRepeat}
              onChange={(e) => setNoRepeat(e.target.checked)}
              disabled={running}
            />
            Không quay trùng số đã ra
          </label>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>

      <section className="log" aria-label="Lịch sử quay">
        <div className="log-top">
          <h2>Lịch sử quay{history.length > 0 && ` (${history.length})`}</h2>
          {history.length > 0 && (
            <div className="log-actions">
              <button className="link" onClick={copyHistory}>
                {copied ? "Đã sao chép" : "Sao chép"}
              </button>
              <button className="link" disabled={running} onClick={clearHistory}>
                Xóa lịch sử
              </button>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <p className="log-empty">Chưa có lượt quay nào. Kết quả sẽ hiện ở đây sau khi bạn bấm quay.</p>
        ) : (
          <div className="log-scroll">
            <table>
              <thead>
                <tr>
                  <th>Lượt</th>
                  <th>Kết quả</th>
                  <th>Khoảng số</th>
                  <th>Lúc</th>
                </tr>
              </thead>
              <tbody>
                {history.map((e, i) => (
                  <tr key={e.at} className={i === 0 ? "latest" : ""}>
                    <td>{history.length - i}</td>
                    <td className="val">{e.value.toLocaleString("vi-VN")}</td>
                    <td>
                      {e.min.toLocaleString("vi-VN")} đến {e.max.toLocaleString("vi-VN")}
                    </td>
                    <td>{formatTime(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
