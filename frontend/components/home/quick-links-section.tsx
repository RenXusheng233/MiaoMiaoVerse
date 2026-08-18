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
      className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 py-12 sm:grid-cols-3"
    >
      {QUICK_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <Card className="h-full border border-grid-line bg-surface text-foreground shadow-panel transition-[transform,border-color,box-shadow] duration-200 ease-out group-hover:-translate-y-1 group-hover:border-signal group-hover:shadow-[0_0_0_1px_var(--glow),var(--panel-shadow)] group-focus-visible:-translate-y-1 group-focus-visible:border-signal group-focus-visible:shadow-[0_0_0_1px_var(--glow),var(--panel-shadow)] motion-reduce:transform-none motion-reduce:transition-none">
            <CardHeader className="h-full content-center gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-surface-strong text-signal">
                  <link.icon aria-hidden="true" className="size-5" />
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 text-signal-secondary transition-transform duration-200 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
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
