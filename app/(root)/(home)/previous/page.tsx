'use client';

import CallList from '@/components/CallList';

const PreviousPage = () => {
  return (
    <section className="flex flex-col gap-8 pt-12 px-4 md:px-6 lg:px-8 font-geist">
      <div className="flex flex-col gap-1 border-b border-black/5 pb-8">
        <h1 className="font-pixel text-4xl font-normal tracking-[-0.02em] text-ink">Previous</h1>
        <p className="font-serif text-base text-ink-muted">Review your past meeting history.</p>
      </div>
      <CallList type="ended" />
    </section>
  );
};

export default PreviousPage;
