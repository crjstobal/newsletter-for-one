import { Eye } from "lucide-react";
import { hasAccess } from "@/lib/access";
import { BannerUnlock } from "./BannerUnlock";

/** Tells visitors up front that the public demo is read-only until they enter the access code. */
export async function ReadOnlyBanner() {
  if (await hasAccess()) return null;
  return (
    <div className="border-b border-rule bg-stamp-soft text-ink dark:bg-stone-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 text-[15px]">
        <Eye size={17} className="shrink-0 text-stamp" />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">Read-only demo.</strong>{" "}
          <span className="hidden sm:inline">Browse every newsletter, issue and trace. Creating newsletters and writing issues needs the access code.</span>
          <span className="sm:hidden">Writing needs the access code.</span>
        </p>
        <BannerUnlock />
      </div>
    </div>
  );
}
