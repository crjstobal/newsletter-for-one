"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UnlockForm } from "./UnlockForm";

/** "Enter code" in the read-only banner; once unlocked the page re-renders without the banner. */
export function BannerUnlock() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="font-semibold text-stamp underline-offset-4 hover:underline">
        Enter access code
      </button>
    );
  }
  return (
    <div className="-mt-3 w-full sm:w-auto">
      <UnlockForm onUnlocked={() => router.refresh()} />
    </div>
  );
}
