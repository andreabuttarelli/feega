"use client";

import React from "react";
import SolarLoader from "@/components/ruixen/solar-loader";

const SolarLoaderDemo = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10">
      <SolarLoader size={40} speed={1} />
      <p className="mt-6 text-center text-sm opacity-80">
        Auto adapts to your system theme and configure 🌙☀️
      </p>
    </div>
  );
};

export default SolarLoaderDemo;
