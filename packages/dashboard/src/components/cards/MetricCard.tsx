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
        "card transition-all hover:border-[#00d1ff]/30",
        highlight && "border-[#00d1ff]/35 bg-[#142126]",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="card-header">{title}</span>
        {icon && <span className="text-[#859399]">{icon}</span>}
      </div>
      <div className="card-value">{value}</div>
      <div className="flex items-center gap-2 mt-2">
        {trend && trendValue && (
          <span
            className={clsx(
              "text-xs font-bold",
              trend === "up" && "text-[#00d1ff]",
              trend === "down" && "text-[#ffb4ab]",
              trend === "neutral" && "text-[#859399]",
            )}
          >
            {trend === "up" ? "+" : trend === "down" ? "-" : ""}
            {trendValue}
          </span>
        )}
        {subtitle && <span className="text-xs text-[#859399]">{subtitle}</span>}
      </div>
    </div>
  );
}
