"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChartDataPoint } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApyChartProps {
  data: ChartDataPoint[];
  currentApy: number;
}

const RANGES: Record<string, { points: number; stepDays: number; monthly?: boolean }> = {
  "1month": { points: 30, stepDays: 1 },
  "3months": { points: 26, stepDays: 3.5 },
  "6months": { points: 26, stepDays: 7 },
  "1year": { points: 24, stepDays: 15, monthly: true },
};

// Deterministic-ish demo series so each range visibly differs (lending data is mock).
function buildSeries(range: string, anchor: number): ChartDataPoint[] {
  const cfg = RANGES[range] ?? RANGES["3months"];
  const base = Number.isFinite(anchor) && anchor > 0 ? anchor : 4;
  const now = Date.now();
  const out: ChartDataPoint[] = [];
  for (let i = 0; i < cfg.points; i++) {
    const fromEnd = cfg.points - 1 - i;
    const d = new Date(now - fromEnd * cfg.stepDays * 86400000);
    const t = i / (cfg.points - 1);
    const wave = Math.sin(i * 0.7) * 0.06 + Math.sin(i * 0.29 + 1) * 0.04;
    const value = Math.max(0.5, base * (0.8 + 0.25 * t + wave));
    const date = cfg.monthly
      ? d.toLocaleDateString("en-US", { month: "short" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    out.push({ date, value });
  }
  return out;
}

export function ApyChart({ currentApy }: ApyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [range, setRange] = useState("3months");
  const series = useMemo(() => buildSeries(range, currentApy), [range, currentApy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 60, bottom: 40, left: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);
    if (series.length === 0) return;

    const values = series.map((d) => d.value);
    const minValue = Math.min(...values) * 0.98;
    const maxValue = Math.max(...values) * 1.02;
    const valueRange = maxValue - minValue || 1;

    const getX = (index: number) =>
      series.length === 1
        ? padding.left + chartWidth
        : padding.left + (index / (series.length - 1)) * chartWidth;
    const getY = (value: number) => padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;

    ctx.strokeStyle = "hsla(215, 20%, 25%, 0.3)";
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i / gridLines) * chartHeight;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, "hsla(74, 100%, 50%, 0.22)");
    gradient.addColorStop(1, "hsla(74, 100%, 50%, 0)");

    ctx.beginPath();
    ctx.moveTo(getX(0), height - padding.bottom);
    series.forEach((point, index) => {
      ctx.lineTo(getX(index), getY(point.value));
    });
    ctx.lineTo(getX(series.length - 1), height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(series[0].value));
    series.forEach((point, index) => {
      if (index > 0) ctx.lineTo(getX(index), getY(point.value));
    });
    ctx.strokeStyle = "hsl(74, 100%, 50%)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "hsla(74, 100%, 50%, 0.5)";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const lastPoint = series[series.length - 1];
    const lastX = getX(series.length - 1);
    const lastY = getY(lastPoint.value);
    ctx.fillStyle = "hsl(215, 20%, 65%)";
    ctx.font = "11px Inter, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${lastPoint.value.toFixed(2)} USDC`, lastX + 8, lastY - 8);

    ctx.fillStyle = "hsl(215, 20%, 50%)";
    ctx.font = "11px Inter, -apple-system, sans-serif";
    ctx.textAlign = "center";
    const labelStep = Math.ceil(series.length / 8);
    series.forEach((point, index) => {
      if (index % labelStep === 0 || index === series.length - 1) {
        ctx.fillText(point.date, getX(index), height - padding.bottom + 20);
      }
    });
  }, [series]);

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Share Price (USDC)</p>
            <div className="w-4 h-4 rounded-full border border-[hsl(var(--border))] flex items-center justify-center">
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">i</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[hsl(var(--foreground))]">
              {(1 + Math.min(Math.max(Number.isFinite(currentApy) ? currentApy : 0, 0), 100) / 100).toFixed(2)}
            </span>
            <span className="text-sm text-[hsl(var(--success))]">+0.8%</span>
          </div>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[120px] h-9 bg-[hsl(var(--secondary))] border-none rounded-lg cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1month">1 month</SelectItem>
            <SelectItem value="3months">3 months</SelectItem>
            <SelectItem value="6months">6 months</SelectItem>
            <SelectItem value="1year">1 year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <canvas ref={canvasRef} className="w-full h-[220px]" />
    </div>
  );
}
