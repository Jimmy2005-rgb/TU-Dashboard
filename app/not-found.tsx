import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="font-mono text-sm font-bold text-tu-600">404</p>
      <h1 className="mt-1 text-xl font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">That course or page doesn&apos;t exist.</p>
      <Link href="/dashboard" className="btn-primary mt-5">
        Back to dashboard
      </Link>
    </div>
  );
}
