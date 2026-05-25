import { CircleNotch } from '@phosphor-icons/react';

const Loader = () => {
  return (
    <div className="flex-center h-screen w-full bg-white/50 backdrop-blur-sm fixed inset-0 z-[9999]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex-center">
          <div className="absolute size-16 rounded-full border-4 border-primary/10" />
          <CircleNotch weight="bold" size={48} className="text-primary animate-spin" />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Workspace</p>
      </div>
    </div>
  );
};

export default Loader;
