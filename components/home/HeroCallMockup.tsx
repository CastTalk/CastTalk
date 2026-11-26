import { Battery, Hand, MessageText, Mic, MicOff, MoreVertical, Phone, Signal, Users, Video, Wifi } from 'pixelarticons/react';

type Tile = {
  name: string;
  initials: string;
  gradient: string;
  speaking?: boolean;
  muted?: boolean;
  hand?: boolean;
};

const TILES: Tile[] = [
  { name: 'Maria', initials: 'M', gradient: 'from-[#9a3412] to-[#f97316]', speaking: true },
  { name: 'Josh', initials: 'J', gradient: 'from-[#3f3f46] to-[#71717a]', muted: true },
  { name: 'Ana', initials: 'A', gradient: 'from-[#c2410c] to-[#fde68a]', hand: true },
  { name: 'You', initials: 'Y', gradient: 'from-[#27272a] to-[#52525b]' },
];

/**
 * Static phone mockup of a CastTalk call in progress — the product shot under the
 * hero heading (pattern: centered headline, product in a device frame, soft glow
 * behind, cut off by the fold). Purely decorative.
 */
const HeroCallMockup = () => (
  <div aria-hidden className="relative mx-auto w-[300px] select-none sm:w-[320px]">
    {/* Ember glow behind the device */}
    <div className="absolute -inset-x-24 -top-10 bottom-0 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(249,115,22,0.35),rgba(253,230,138,0.25)_55%,transparent)] blur-2xl" />

    {/* Device frame */}
    <div className="rounded-[46px] bg-ink p-[10px] shadow-[0_30px_80px_-20px_rgba(154,52,18,0.45)]">
      <div className="relative h-[600px] overflow-hidden rounded-[36px] bg-[#121212] text-white">
        {/* Status bar */}
        <div className="flex items-center justify-between px-7 pt-3.5 text-[12px] font-semibold">
          <span>9:41</span>
          <div className="absolute left-1/2 top-2.5 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
          <div className="flex items-center gap-1">
            <Signal className="size-3.5" />
            <Wifi className="size-3.5" />
            <Battery className="size-4" />
          </div>
        </div>

        {/* Meeting header */}
        <div className="mt-5 flex items-center justify-between px-4">
          <div className="flex flex-col">
            <span className="font-pixel text-[15px] leading-none">Weekly sync</span>
            <span className="mt-1 font-mono text-[10px] lowercase tracking-wide text-white/50">kxq-rbtd-mna · 12:04</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold">
            <Users className="size-3.5" />4
          </div>
        </div>

        {/* Participant grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 px-3">
          {TILES.map((t) => (
            <div
              key={t.name}
              className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${t.gradient} ${
                t.speaking ? 'ring-2 ring-[#fde68a] ring-offset-2 ring-offset-[#121212]' : ''
              }`}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-white/15 font-pixel text-xl">
                {t.initials}
              </div>
              {t.hand ? (
                <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-[#fde68a] px-2 py-0.5 text-[10px] font-semibold text-[#9a3412]">
                  <Hand className="size-3" />
                  {t.name}
                </div>
              ) : (
                <span className="absolute bottom-2 left-2 text-[11px] font-semibold drop-shadow">{t.name}</span>
              )}
              {t.muted && (
                <div className="absolute right-2 top-2 rounded-full bg-black/40 p-1">
                  <MicOff className="size-3" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Live caption (Taglish) */}
        <div className="mx-3 mt-3 rounded-2xl bg-white/[0.08] px-3.5 py-2.5 backdrop-blur">
          <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-[#fde68a]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#f97316]" />
            Live caption · Maria
          </div>
          <p className="mt-1 font-serif text-[13px] leading-snug text-white/90">
            Okay, let&apos;s start na. Can everyone see my screen?
          </p>
        </div>

        {/* Control bar */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent pb-6 pt-6">
          {[Mic, Video, MessageText, Hand].map((Icon, i) => (
            <div
              key={i}
              className={`flex size-10 items-center justify-center rounded-full ${
                i === 2 ? 'bg-[#f97316] text-white' : 'bg-white/15'
              }`}
            >
              <Icon className="size-[18px]" />
            </div>
          ))}
          <div className="flex h-10 w-14 items-center justify-center rounded-full bg-[#dc2626]">
            <Phone className="size-[18px] rotate-[135deg]" />
          </div>
          <div className="flex size-10 items-center justify-center rounded-full bg-white/15">
            <MoreVertical className="size-[18px]" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default HeroCallMockup;
