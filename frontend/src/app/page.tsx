import Link from 'next/link';

export default function Home() {
  return (
    <div className="text-center py-20">
      <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
        Subscription Billing Platform
      </h1>
      <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
        A billing platform with Razorpay integration,
        subscription lifecycle management, and automated invoicing.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link
          href="/pricing"
          className="inline-flex items-center px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
        >
          View Plans
        </Link>
        <Link
          href="/register"
          className="inline-flex items-center px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
