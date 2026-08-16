import Link from 'next/link'
import { StudioWorkspace } from '@/components/meme-studio/studio-workspace'

export default function MemeStudioPage() {
  return (
    <>
      {/* The editor is desktop-only (three-panel layout needs a wide screen).
          Pure CSS gating — below md mobile visitors get the notice instead.
          No hydration flash; the canvas ResizeObserver re-scales if the
          breakpoint flips (e.g. phone landscape). */}
      <div className="hidden md:block">
        <StudioWorkspace />
      </div>
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center md:hidden">
        <span className="text-6xl" aria-hidden>
          🐱
        </span>
        <h1 className="font-heading text-2xl text-foreground">表情包工作室</h1>
        <p className="font-medium text-foreground">该功能仅支持 PC 端使用</p>
        <p className="text-sm text-muted-foreground">
          请使用电脑浏览器打开本页面，体验完整的拖拽式表情包创作
        </p>
        <Link
          href="/"
          className="mt-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 返回首页
        </Link>
      </div>
    </>
  )
}
