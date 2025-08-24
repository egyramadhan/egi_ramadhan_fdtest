'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface VerificationResult {
  success: boolean;
  message: string;
  user?: {
    id: string;
    name: string;
    email: string;
    emailVerifiedAt: string;
    isAdmin: boolean;
  };
}

export default function VerifyEmailPage() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setResult({
          success: false,
          message: 'No verification token provided'
        });
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        
        if (response.ok) {
          setResult({
            success: true,
            message: data.message || 'Email verified successfully!',
            user: data.data?.user
          });
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/auth/login?verified=true');
          }, 3000);
        } else {
          setResult({
            success: false,
            message: data.message || 'Email verification failed'
          });
        }
      } catch (error) {
        console.error('Verification error:', error);
        setResult({
          success: false,
          message: 'An error occurred during verification'
        });
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Verifying your email...
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we verify your email address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {result?.success ? (
            <>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Email Verified!
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {result.message}
              </p>
              {result.user && (
                <div className="mt-4 p-4 bg-green-50 rounded-md">
                  <p className="text-sm text-green-800">
                    Welcome, {result.user.name}! Your account is now active.
                  </p>
                </div>
              )}
              <p className="mt-4 text-sm text-gray-500">
                Redirecting to login page in a few seconds...
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Verification Failed
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {result?.message || 'Unable to verify your email address.'}
              </p>
              <div className="mt-4 p-4 bg-red-50 rounded-md">
                <p className="text-sm text-red-800">
                  The verification link may have expired or is invalid.
                </p>
              </div>
            </>
          )}
          
          <div className="mt-6 space-y-2">
            <Link
              href="/auth/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go to Login
            </Link>
            <Link
              href="/"
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}