"use client";

import { IconPagination } from "@/components/ruixen/icon-pagination";

export default function IconPaginationDemo() {
  return (
    <div className="flex min-h-[420px] w-full items-center justify-center px-4">
      <IconPagination totalPages={12} maxVisible={9} />
    </div>
  );
}
