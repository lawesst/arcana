"use client";

import { clsx } from "clsx";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  highlight,
}: MetricCardProps) {
  return (
    <div
      className={clsx(
        "card transition-all hover:border-arcana-700/50",
        highlight && "border-arcana-600/40 bg-arcana-950/20",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="card-header">{title}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className="card-value">{value}</div>
      <div className="flex items-center gap-2 mt-2">
        {trend && trendValue && (
          <span
            className={clsx(
              "text-xs font-medium",
              trend === "up" && "text-emerald-400",
              trend === "down" && "text-red-400",
              trend === "neutral" && "text-slate-400",
            )}
          >
            {trend === "up" ? "+" : trend === "down" ? "-" : ""}
            {trendValue}
          </span>
        )}
        {subtitle && (
          <span className="text-xs text-slate-500">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
