import { Hand, MessageText, Mic, MicOff, MoreVertical, Phone, Users, Video } from 'pixelarticons/react';

type Tile = { name: string; initials: string; gradient: string; speaking?: boolean; muted?: boolean; hand?: boolean };

const TILES: Tile[] = [
  { name: 'Maria', initials: 'M', gradient: 'from-[#9a3412] to-[#f97316]', speaking: true },
  { name: 'Josh', initials: 'J', gradient: 'from-[#3f3f46] to-[#71717a]', muted: true },
  { name: 'Ana', initials: 'A', gradient: 'from-[#c2410c] to-[#fde68a]', hand: true },
  { name: 'Paolo', initials: 'P', gradient: 'from-[#27272a] to-[#52525b]' },
  { name: 'Bea', initials: 'B', gradient: 'from-[#7c2d12] to-[#ea580c]', muted: true },
  { name: 'You', initials: 'Y', gradient: 'from-[#18181b] to-[#3f3f46]' },
];

/**
 * Product shot under the hero: a laptop turned slightly to the left showing a
 * CastTalk call. Everything on the screen is sized in container-query units
 * (cqw), so the whole picture scales as one image from phone to desktop.
 * Purely decorative.
 */
const HeroLaptopMockup = () => (
  <div aria-hidden className="relative mx-auto w-[82%] max-w-[595px] select-none [perspective:2200px] sm:w-[88%]">
    {/* Ember glow behind the device */}
    <div className="absolute -inset-x-10 -top-6 bottom-6 -z-10 rounded-[50%] bg-[radial-gradient(closest-side,rgba(249,115,22,0.32),rgba(253,230,138,0.22)_55%,transparent)] blur-2xl" />

    <div className="origin-bottom [transform-style:preserve-3d] [transform:rotateX(7deg)_rotateY(14deg)_rotateZ(-0.6deg)]">
      {/* Lid */}
      <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#1c1c1f] p-[1.1%] pb-[1.6%] shadow-[0_40px_80px_-30px_rgba(154,52,18,0.55)] [container-type:inline-size]">
        <div className="relative flex aspect-[16/10] flex-col overflow-hidden rounded-[1cqw] bg-[#121212] px-[2.2cqw] pb-[1.6cqw] pt-[1.8cqw] text-white">
          {/* Camera notch */}
          <div className="absolute left-1/2 top-0 h-[1.6cqw] w-[9cqw] -translate-x-1/2 rounded-b-[0.8cqw] bg-[#1c1c1f]" />

          {/* Meeting header */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-[1.2cqw]">
              <span className="font-pixel text-[2.1cqw] leading-none">Weekly sync</span>
              <span className="font-mono text-[1.2cqw] lowercase text-white/50">kxq-rbtd-mna · 12:04</span>
            </div>
            <div className="flex items-center gap-[0.5cqw] rounded-[0.8cqw] bg-white/10 px-[1cqw] py-[0.5cqw] text-[1.3cqw] font-semibold">
              <Users className="size-[1.6cqw]" />6
            </div>
          </div>

          {/* Participant grid */}
          <div className="mt-[1.6cqw] grid flex-1 grid-cols-3 grid-rows-2 gap-[0.9cqw]">
            {TILES.map((t) => (
              <div
                key={t.name}
                className={`relative flex items-center justify-center overflow-hidden rounded-[1.2cqw] bg-gradient-to-br ${t.gradient} ${
                  t.speaking ? 'ring-[0.25cqw] ring-[#fde68a]' : ''
                }`}
              >
                <div className="flex size-[5.4cqw] items-center justify-center rounded-full bg-white/15 font-pixel text-[2.4cqw]">
                  {t.initials}
                </div>
                {t.hand ? (
                  <div className="absolute bottom-[0.9cqw] left-[0.9cqw] flex items-center gap-[0.4cqw] rounded-full bg-[#fde68a] px-[0.9cqw] py-[0.3cqw] text-[1.15cqw] font-semibold text-[#9a3412]">
                    <Hand className="size-[1.3cqw]" />
                    {t.name}
                  </div>
                ) : (
                  <span className="absolute bottom-[0.9cqw] left-[1cqw] text-[1.25cqw] font-semibold drop-shadow">{t.name}</span>
                )}
                {t.muted && (
                  <div className="absolute right-[0.9cqw] top-[0.9cqw] rounded-full bg-black/40 p-[0.45cqw]">
                    <MicOff className="size-[1.2cqw]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Live caption + controls */}
          <div className="mt-[1.4cqw] flex items-center justify-between gap-[1.5cqw]">
            <div className="min-w-0 flex-1 rounded-[1cqw] bg-white/[0.08] px-[1.4cqw] py-[0.9cqw]">
              <div className="flex items-center gap-[0.6cqw] font-mono text-[0.95cqw] uppercase tracking-widest text-[#fde68a]">
                <span className="size-[0.6cqw] rounded-full bg-[#f97316]" />
                Live caption · Maria
              </div>
              <p className="mt-[0.3cqw] truncate font-serif text-[1.5cqw] text-white/90">
                Okay, let&apos;s start na. Can everyone see my screen?
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-[0.8cqw]">
              {[Mic, Video, MessageText, Hand].map((Icon, i) => (
                <div
                  key={i}
                  className={`flex size-[3.6cqw] items-center justify-center rounded-full ${i === 2 ? 'bg-[#f97316]' : 'bg-white/15'}`}
                >
                  <Icon className="size-[1.7cqw]" />
                </div>
              ))}
              <div className="flex h-[3.6cqw] w-[5.4cqw] items-center justify-center rounded-full bg-[#dc2626]">
                <Phone className="size-[1.7cqw] rotate-[135deg]" />
              </div>
              <div className="flex size-[3.6cqw] items-center justify-center rounded-full bg-white/15">
                <MoreVertical className="size-[1.7cqw]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Base: a solid slab folded toward the viewer. preserve-3d lets its front
          layers stacked beneath it give it real thickness.
          A 3D transform keeps the flat layout height, so the negative margin gives
          that empty space back. */}
      <div className="relative mx-auto -mt-[2px] mb-[-30%] w-[104%] origin-top -translate-x-[1.9%] [container-type:inline-size] [transform-style:preserve-3d] [transform:rotateX(74deg)]">
        {/* Thickness: copies of the deck outline stacked just beneath the surface
            (same shape and tilt, so their edges always line up with the deck's
            corners — nothing sticks out). The visible slivers read as the slab's
            front and right side. */}
        {Array.from({ length: 10 }, (_, i) => (i + 1) * 0.25).map((depth, i) => (
          <div
            key={depth}
            aria-hidden
            className="absolute inset-0 rounded-b-[1.6cqw] rounded-t-[1cqw]"
            style={{
              // 10 thin steps blend into one continuous edge; darker the deeper it goes
              transform: `translateZ(-${depth}cqw)`,
              background: `rgb(${38 - i * 3}, ${38 - i * 3}, ${42 - i * 3})`,
            }}
          />
        ))}
        {/* Deck surface */}
        <div className="relative aspect-[16/8.5] rounded-b-[1.6cqw] rounded-t-[1cqw] border-x border-t border-white/10 bg-gradient-to-b from-[#45454c] via-[#323237] to-[#2a2a2f] px-[6cqw] pt-[3.4cqw]">
          {/* Hinge recess along the top of the deck */}
          <div className="absolute inset-x-[4%] top-0 h-[1.6cqw] rounded-b-[1cqw] bg-gradient-to-b from-[#121214] to-transparent" />
          <div className="grid gap-[0.7cqw]" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
            {Array.from({ length: 14 * 5 }).map((_, i) => (
              <div key={i} className="h-[3.6cqw] rounded-[0.5cqw] bg-[#161618] shadow-[inset_0_-0.25cqw_0_rgba(255,255,255,0.05)]" />
            ))}
          </div>
          <div className="mx-auto mt-[3cqw] h-[16cqw] w-[38%] rounded-[1.4cqw] border border-white/5 bg-[#29292e]" />
        </div>
      </div>
    </div>
  </div>
);

export default HeroLaptopMockup;
