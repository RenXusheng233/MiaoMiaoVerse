export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] animate-pulse flex-col bg-muted/30">
      <div className="h-14 border-b border-border" />
      <div className="flex flex-1">
        <div className="w-56 border-r border-border" />
        <div className="flex-1" />
        <div className="w-72 border-l border-border" />
      </div>
    </div>
  )
}
