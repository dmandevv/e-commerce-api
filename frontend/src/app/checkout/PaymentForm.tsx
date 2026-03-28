"use client";

import { useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

interface PaymentFormProps {
  orderId: string;
  total: number;
}

export default function PaymentForm({ total }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Payment system not ready. Please refresh the page.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // Confirm payment with Stripe
    // This will redirect to /orders on success (via return_url)
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders`,
      },
    });

    // Only reaches here if there's an error (redirect happens on success)
    if (stripeError) {
      setError(stripeError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <p className="font-semibold mb-1">Test Mode — No real charges will be made</p>
        <p>Use this dummy card: 4242 4242 4242 4242 | Exp: 12/28 | CVC: 123 | ZIP: 12345</p>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <PaymentElement />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200] h-12 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Processing..." : `Pay $${total.toFixed(2)}`}
      </Button>

      <p className="text-xs text-center text-gray-500">
        Your payment information is secure and encrypted.
      </p>
    </form>
  );
}
