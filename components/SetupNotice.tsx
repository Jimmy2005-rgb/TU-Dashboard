import { AlertTriangle } from "lucide-react";

/** Shown instead of a page when env vars or the database aren't set up yet. */
export default function SetupNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-10 max-w-xl card p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <h1 className="font-semibold text-slate-900">Setup needed</h1>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
          <p className="mt-3 text-sm text-slate-500">
            See the README: copy <code className="rounded bg-slate-100 px-1">.env.local.example</code> to{" "}
            <code className="rounded bg-slate-100 px-1">.env.local</code>, fill in your keys, and run{" "}
            <code className="rounded bg-slate-100 px-1">supabase/schema.sql</code> in the Supabase SQL editor.
          </p>
        </div>
      </div>
    </div>
  );
}
