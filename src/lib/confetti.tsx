import { useEffect, useState } from "react";

interface Piece {
  id: number;
  left: number;
  delay: number;
  bg: string;
  rotate: number;
}

const COLORS = [
  "var(--priority-critical)",
  "var(--priority-urgent)",
  "var(--priority-moderate)",
  "var(--priority-stable)",
  "var(--primary)",
];

export function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const next: Piece[] = Array.from({ length: 28 }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.25,
      bg: COLORS[i % COLORS.length],
      rotate: Math.random() * 360,
    }));
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 1600);
    return () => clearTimeout(t);
  }, [trigger]);

  if (pieces.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 h-2.5 w-2.5 rounded-sm"
          style={{
            left: `${p.left}%`,
            background: p.bg,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall 1.4s ${p.delay}s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}