import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} aria-hidden />;
}
