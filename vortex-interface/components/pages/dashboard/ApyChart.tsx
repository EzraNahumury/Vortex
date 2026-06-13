"use client";

import { useEffect, useRef } from "react";
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

export function ApyChart({ data, currentApy }: ApyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    if (data.length === 0) return;

    const values = data.map((d) => d.value);
    const minValue = Math.min(...values) * 0.98;
    const maxValue = Math.max(...values) * 1.02;
    const valueRange = maxValue - minValue;

    const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
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
    gradient.addColorStop(0, "hsla(189, 94%, 43%, 0.15)");
    gradient.addColorStop(1, "hsla(189, 94%, 43%, 0)");

    ctx.beginPath();
    ctx.moveTo(getX(0), height - padding.bottom);
    data.forEach((point, index) => {
      ctx.lineTo(getX(index), getY(point.value));
    });
    ctx.lineTo(getX(data.length - 1), height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].value));
    data.forEach((point, index) => {
      if (index > 0) {
        ctx.lineTo(getX(index), getY(point.value));
      }
    });
    ctx.strokeStyle = "hsl(189, 94%, 43%)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const lastPoint = data[data.length - 1];
    const lastX = getX(data.length - 1);
    const lastY = getY(lastPoint.value);

    ctx.fillStyle = "hsl(215, 20%, 65%)";
    ctx.font = "11px Inter, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${lastPoint.value.toFixed(2)} USDC`, lastX + 8, lastY - 8);

    ctx.fillStyle = "hsl(215, 20%, 50%)";
    ctx.font = "11px Inter, -apple-system, sans-serif";
    ctx.textAlign = "center";
    const labelStep = Math.ceil(data.length / 8);
    data.forEach((point, index) => {
      if (index % labelStep === 0 || index === data.length - 1) {
        ctx.fillText(point.date, getX(index), height - padding.bottom + 20);
      }
    });
  }, [data]);

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
            <span className="text-3xl font-semibold text-[hsl(var(--foreground))]">1.{Math.floor(currentApy * 26)}</span>
            <span className="text-sm text-[hsl(var(--success))]">+0.8%</span>
          </div>
        </div>
        <Select defaultValue="3months">
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
