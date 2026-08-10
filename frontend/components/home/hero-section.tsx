"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CatBreed } from "@/lib/types/cat";

interface HeroSectionProps {
  cat: CatBreed;
}

export function HeroSection({ cat }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const cloudsY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const pawsY = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const catY = useTransform(scrollYProgress, [0, 1], [0, -240]);
  const catOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative flex h-[90vh] min-h-[560px] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-secondary via-background to-background"
    >
      <motion.div
        style={{ y: cloudsY }}
        className="pointer-events-none absolute inset-x-0 top-10 flex justify-between px-8 text-6xl opacity-40"
        aria-hidden
      >
        <span>☁️</span>
        <span>☁️</span>
      </motion.div>

      <motion.div
        style={{ y: pawsY }}
        className="pointer-events-none absolute inset-0 grid grid-cols-4 place-items-center text-4xl opacity-20"
        aria-hidden
      >
        <span>🐾</span>
        <span>✨</span>
        <span>🐾</span>
        <span>✨</span>
      </motion.div>

      <motion.div
        style={{ y: catY, opacity: catOpacity }}
        className="relative z-10 mb-6 h-40 w-40 overflow-hidden rounded-full border-4 border-card shadow-xl sm:h-56 sm:w-56"
      >
        <Image
          src={cat.image_url}
          alt={cat.name_zh}
          fill
          className="object-cover"
          priority
        />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
        <h1 className="font-heading text-4xl text-foreground sm:text-5xl">
          喵喵宇宙 MiaoMiaoVerse
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          猫咪百科 · AI 文案 · 表情包生成 · 疗愈问答，一站式猫奴乐园
        </p>
        <a
          href="#quick-links"
          className={cn(buttonVariants({ size: "lg" }), "mt-2")}
        >
          进入探索
        </a>
      </div>
    </section>
  );
}
