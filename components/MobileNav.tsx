import { List, House, CalendarCheck, VideoCamera, ClockCounterClockwise,PlusSquare } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { sidebarLinks } from '@/constants';
import { cn } from '@/lib/utils';

const iconMap: Record<string, any> = {
  '/': House,
  '/upcoming': CalendarCheck,
  '/previous': ClockCounterClockwise,
  '/recordings': VideoCamera,
  '/personal-room': PlusSquare,
};

const MobileNav = () => {
  const pathname = usePathname();

  return (
    <section className="w-full max-w-[264px] font-heading">
      <Sheet>
        <SheetTrigger asChild>
          <div className="size-10 rounded-xl bg-white border border-slate-100 flex-center shadow-sm cursor-pointer sm:hidden">
            <List weight="bold" size={24} className="text-slate-600" />
          </div>
        </SheetTrigger>
        <SheetContent side="left" className="border-none bg-white p-0 w-[300px]">
          <div className="p-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="size-8 bg-primary rounded-lg flex-center shadow-sm group-hover:rotate-12 transition-transform duration-300">
                <VideoCamera weight="bold" size={18} className="text-white" />
              </div>
              <span className="text-xl font-bold tracking-tightest text-slate-900">CanTalk</span>
            </Link>
          </div>

          <div className="flex h-[calc(100vh-72px)] flex-col justify-between overflow-y-auto px-4 pb-8">
            <SheetClose asChild>
              <section className="flex h-full flex-col gap-2">
                {sidebarLinks.map((item) => {
                  const isActive = pathname === item.route || pathname.startsWith(`${item.route}/`);
                  const Icon = iconMap[item.route] || House;

                  return (
                    <SheetClose asChild key={item.route}>
                      <Link
                        href={item.route}
                        key={item.label}
                        className={cn(
                          'flex gap-4 items-center p-4 rounded-2xl w-full transition-all duration-300',
                          isActive 
                            ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        )}
                      >
                        <Icon 
                          weight={isActive ? "bold" : "regular"} 
                          size={24} 
                        />
                        <p className="font-bold">{item.label}</p>
                      </Link>
                    </SheetClose>
                  );
                })}
              </section>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};

export default MobileNav;
