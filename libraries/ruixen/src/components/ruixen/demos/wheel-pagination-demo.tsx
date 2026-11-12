"use client";

import { WheelPagination } from "@/components/ruixen/wheel-pagination";

export default function WheelPaginationDemo() {
  return (
    <div className="flex min-h-[420px] w-full items-center justify-center px-4">
      <WheelPagination totalPages={50} visibleCount={7} />
    </div>
  );
}
