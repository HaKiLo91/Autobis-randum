"use client";

import { useEffect, useRef, useState } from "react";

const LIMIT = 1_000_000_000;

// Số ngẫu nhiên an toàn (không bị lệch), dùng crypto của trình duyệt
function randomInt(min, max) {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  const cap = Math.floor(4294967296 / range) * range;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= cap);
  return min + (buf[0] % range);
}

function pickResult(min, max, used) {
  const total = max - min + 1;
  if (total <= 100000) {
    const pool = [];
    for (let i = min; i <= max; i++) if (!used.has(i)) pool.push(i);
    return pool[randomInt(0, pool.length - 1)];
  }
  let n;
  do {
    n = randomInt(min, max);
  } while (used.has(n));
  return n;
}

function ballFontSize(text) {
  const len = text.length;
  if (len <= 3) return "5.5rem";
  if (len <= 5) return "4.2rem";
  if (len <= 8) return "3rem";
  return "2.2rem";
}

export default function Home() {
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("100");
  const [seconds, setSeconds] = useState(5);
  const [noRepeat, setNoRepeat] = useState(true);
  const [status, setStatus] = useState("idle"); // idle | running | done
  const [shown, setShown] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function start() {
    const min = Number(from);
    const max = Number(to);

    if (
      from.trim() === "" ||
      to.trim() === "" ||
      !Number.isInteger(min) ||
      !Number.isInteger(max)
    ) {
      return setError("Hãy nhập số nguyên cho cả hai ô.");
    }
    if (Math.abs(min) > LIMIT || Math.abs(max) > LIMIT) {
      return setError("Giới hạn tối đa là 1.000.000.000.");
    }
    if (min >= max) {
      return setError("Số bắt đầu phải nhỏ hơn số kết thúc.");
    }

    const used = new Set(
      noRepeat ? history.filter((n) => n >= min && n <= max) : [],
    );
    if (used.size >= max - min + 1) {
      return setError(
        "Đã quay hết các số trong khoảng này. Hãy xóa lịch sử hoặc đổi khoảng số.",
      );
    }

    setError("");
    setStatus("running");

    const result = pickResult(min, max, used);
    const startedAt = performance.now();
    const total = seconds * 1000;

    const tick = () => {
      const t = Math.min((performance.now() - startedAt) / total, 1);
      if (t >= 1) {
        setShown(result);
        setHistory((h) => [result, ...h]);
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
            {running
              ? "Đang quay..."
              : status === "done"
                ? "Quay tiếp"
                : "Quay số"}
          </button>

          {history.length > 0 && (
            <div className="history">
              <div className="history-top">
                <h2>Đã quay ({history.length})</h2>
                <button
                  className="link"
                  disabled={running}
                  onClick={() => {
                    setHistory([]);
                    setShown(null);
                    setStatus("idle");
                  }}
                >
                  Xóa lịch sử
                </button>
              </div>
              <ul>
                {history.map((n, i) => (
                  <li
                    key={`${n}-${history.length - i}`}
                    className={i === 0 ? "latest" : ""}
                  >
                    {n.toLocaleString("vi-VN")}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
    </main>
  );
}
