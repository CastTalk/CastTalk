import { cn } from '@/lib/utils';

/**
 * CastTalk wordmark in the signature pixel font. The ember square is the mark.
 * Geist Pixel is a single-weight bitmap face, so size (not weight) controls
 * how heavy it reads — keep it small.
 */
const Logo = ({ className, tone = 'ink' }: { className?: string; tone?: 'ink' | 'light' }) => (
  <span
    className={cn(
      'inline-flex select-none items-center gap-2 font-pixel text-[18px] leading-none tracking-[-0.01em]',
      tone === 'ink' ? 'text-ink' : 'text-white',
      className
    )}
  >
    <span aria-hidden className="size-2.5 bg-ember" />
    CastTalk
  </span>
);

export default Logo;
