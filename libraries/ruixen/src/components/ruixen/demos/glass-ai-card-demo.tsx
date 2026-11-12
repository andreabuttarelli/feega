"use client";

import GlassAICard from "@/components/ruixen/glass-ai-card";

export default function GlassAICardDemo() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <GlassAICard onAction={() => console.log("Summarize")} />
    </div>
  );
}
