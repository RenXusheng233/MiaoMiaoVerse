import Link from 'next/link'
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
  gradientFrom: string
  gradientTo: string
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/chat',
    title: 'AI 疗愈问答',
    description: '有什么烦心事？跟猫咪 AI 聊聊，治愈一下。',
    gradientFrom: 'oklch(0.82 0.12 55)',
    gradientTo: 'oklch(0.92 0.08 95)',
  },
  {
    href: '/meme-studio',
    title: '表情包工作室',
    description: '拖拽拼装文字与贴纸，创作专属表情包。',
    gradientFrom: 'oklch(0.85 0.09 175)',
    gradientTo: 'oklch(0.85 0.1 230)',
  },
  {
    href: '/copywriting',
    title: '朋友圈文案神器',
    description: '三种风格文案任你选，一键复制发圈。',
    gradientFrom: 'oklch(0.82 0.11 10)',
    gradientTo: 'oklch(0.78 0.14 30)',
  },
]

export function QuickLinksSection() {
  return (
    <section
      id="quick-links"
      className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-6 py-16 sm:grid-cols-3"
    >
      {QUICK_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="group">
          <Card
            className="h-full border-none text-white shadow-lg transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-xl"
            style={{
              background: `linear-gradient(135deg, ${link.gradientFrom}, ${link.gradientTo})`,
            }}
          >
            <CardHeader>
              <CardTitle className="font-heading text-2xl">
                {link.title}
              </CardTitle>
              <CardDescription className="text-white/85">
                {link.description}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </section>
  )
}
