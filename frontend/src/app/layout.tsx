import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Script from 'next/script';
import { NavBar } from '@/components/ui/NavBar';

export const metadata: Metadata = {
  title: 'Subscription Billing Platform',
  description: 'Manage your SaaS subscriptions with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Razorpay Checkout.js — loaded once for the entire app */}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          <NavBar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
