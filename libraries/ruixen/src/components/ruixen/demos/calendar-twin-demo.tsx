"use client";

import { CalendarTwin } from "@/components/ruixen/calendar-twin";

export default function CalendarTwinDemo() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <CalendarTwin
        onRangeChange={(start, end) => {
          if (start && end) {
            console.log("Range:", start, "→", end);
          }
        }}
      />
    </div>
  );
}
