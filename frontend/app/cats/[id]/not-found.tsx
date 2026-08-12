import Link from 'next/link'

export default function CatNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h2 className="font-heading text-3xl text-foreground">喵呜…没有这只猫</h2>
      <p className="max-w-md text-muted-foreground">
        这个品种不存在或已被删除。
      </p>
      <Link href="/" className="text-sm text-primary underline">
        返回首页
      </Link>
    </div>
  )
}
