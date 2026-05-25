'use client';

import CallList from '@/components/CallList';

const PreviousPage = () => {
  return (
    <section className="flex flex-col gap-8 pt-12 px-4 md:px-6 lg:px-8 font-geist">
      <div className="flex flex-col gap-1 border-b border-dashed border-[#c4cccc] pb-8">
        <h1 className="text-3xl font-normal tracking-tight text-black">Previous</h1>
        <p className="text-sm text-slate-500">Review your past meeting history.</p>
      </div>
      <CallList type="ended" />
    </section>
  );
};

export default PreviousPage;
