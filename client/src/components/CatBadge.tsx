import React from "react";
import catGif from "../assets/cat.gif";

export default function CatBadge() {
  return (
    <div
      className="absolute z-[1000] flex flex-col items-center pointer-events-none select-none"
      style={{ top: 6, right: 12 }}   // স্ক্রল করলে এখন সাথে সাথে নড়বে
    >
      <img
        src={catGif}
        alt="cat"
        style={{ width: 70, height: 55, objectFit: "contain", marginBottom: "-6px" }}
      />
      <span className="text-slate-500 text-sm font-semibold drop-shadow">
        Your first step into decentralization
      </span>
    </div>
  );
}
