import { CosmicBackground } from '@/components/home/cosmic-background'

export default function Loading() {
  return (
    <main className="chat-shell">
      <CosmicBackground />
      <div className="chat-console chat-console--loading">
        <div className="chat-loading__header">
          <div className="chat-loading__back" />
          <div className="chat-loading__eyebrow" />
          <div className="chat-loading__title" />
          <div className="chat-loading__description" />
        </div>
        <div className="chat-console__surface chat-loading__surface">
          <div className="chat-loading__stream">
            <div className="chat-loading__line chat-loading__line--short" />
            <div className="chat-loading__line chat-loading__line--long" />
          </div>
          <div className="chat-loading__composer" />
        </div>
      </div>
    </main>
  )
}
