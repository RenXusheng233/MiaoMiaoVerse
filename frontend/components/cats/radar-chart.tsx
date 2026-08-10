"use client";

import { motion } from "motion/react";

import type { CatScores } from "@/lib/types/cat";

const DIMENSIONS = [
  { key: "demolition", label: "拆家" },
  { key: "clingy", label: "粘人" },
  { key: "shedding", label: "掉毛" },
  { key: "cost", label: "掉钱包" },
  { key: "looks", label: "颜值" },
] as const;

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 88;

function polar(index: number, ratio: number): [number, number] {
  const angle = (Math.PI * 2 * index) / DIMENSIONS.length - Math.PI / 2;
  return [
    CENTER + RADIUS * ratio * Math.cos(angle),
    CENTER + RADIUS * ratio * Math.sin(angle),
  ];
}

function polygonPoints(ratio: number): string {
  return DIMENSIONS.map((_, i) => polar(i, ratio).join(",")).join(" ");
}

export function RadarChart({ scores }: { scores: CatScores }) {
  const dataPoints = DIMENSIONS.map((d, i) =>
    polar(i, scores[d.key] / 10).join(",")
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto w-full max-w-xs text-foreground"
      role="img"
      aria-label="五维雷达图"
    >
      {/* 满分线、基准 5 分线网格、轴线 */}
      <polygon
        points={polygonPoints(1)}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={1}
      />
      <polygon
        points={polygonPoints(0.5)}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      {DIMENSIONS.map((d, i) => {
        const [x, y] = polar(i, 1);
        return (
          <line
            key={d.key}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.18}
          />
        );
      })}

      {/* 数据多边形(奶油马卡龙色 + 入场动画) */}
      <motion.polygon
        points={dataPoints}
        className="fill-radar-fill/40 stroke-radar-stroke"
        fillOpacity={1}
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* 顶点标签:维度名 + 分值 */}
      {DIMENSIONS.map((d, i) => {
        const [x, y] = polar(i, 1.2);
        return (
          <text
            key={d.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[12px]"
          >
            {d.label} {scores[d.key]}
          </text>
        );
      })}
    </svg>
  );
}
