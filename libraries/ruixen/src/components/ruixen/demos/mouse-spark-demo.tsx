"use client";

import React from "react";
import MouseSpark from "@/components/ruixen/mouse-spark";

export default function MouseSparkDemo() {
  return (
    <div className="relative w-full mx-auto overflow-hidden">
      <MouseSpark width={1000} height={600} theme="light" />
    </div>
  );
}
