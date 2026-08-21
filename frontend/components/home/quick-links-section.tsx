import Link from 'next/link'
import {
  ArrowUpRight,
  ImagePlus,
  MessageCircle,
  PenLine,
  type LucideIcon,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

import styles from './home.module.css'

interface QuickLink {
  href: string
  title: string
  description: string
  icon: LucideIcon
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/chat',
    title: 'AI 疗愈问答',
    description: '有什么烦心事？跟猫咪 AI 聊聊，治愈一下。',
    icon: MessageCircle,
  },
  {
    href: '/meme-studio',
    title: '表情包工作室',
    description: '拖拽拼装文字与贴纸，创作专属表情包。',
    icon: ImagePlus,
  },
  {
    href: '/copywriting',
    title: '朋友圈文案神器',
    description: '三种风格文案任你选，一键复制发圈。',
    icon: PenLine,
  },
]

export function QuickLinksSection() {
  return (
    <section
      id="missions"
      className="relative mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 py-12 sm:grid-cols-3"
    >
      {QUICK_LINKS.map((link, index) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            styles['mission-card'],
            'group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plasma focus-visible:ring-offset-4 focus-visible:ring-offset-background',
          )}
        >
          <Card
            className={cn(
              styles['mission-card__surface'],
              'h-full border border-grid-line bg-surface text-foreground shadow-panel transition-[transform,border-color,box-shadow] duration-200 ease-out group-hover:-translate-y-1 group-hover:border-rift group-focus-visible:-translate-y-1 group-focus-visible:border-rift motion-reduce:transform-none motion-reduce:transition-none',
            )}
          >
            <span
              aria-hidden="true"
              className={styles['mission-card__starchart']}
            />
            <CardHeader className="relative z-2 h-full content-center gap-3">
              <p className="font-mono text-[0.58rem] tracking-[0.2em] text-rift-secondary uppercase">
                Mission node / 0{index + 1}
              </p>
              <div className="flex items-start justify-between gap-4">
                <div
                  className={cn(
                    styles['mission-card__icon'],
                    'flex size-10 items-center justify-center rounded-lg bg-surface-strong text-plasma',
                  )}
                >
                  <link.icon aria-hidden="true" className="size-5" />
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 text-rift-secondary transition-transform duration-200 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </section>
  )
}
