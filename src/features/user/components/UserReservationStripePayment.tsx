import { forwardRef, useEffect, useImperativeHandle, useState } from "react"

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe, type Stripe } from "@stripe/stripe-js"

export type UserReservationStripePaymentHandle = {
  confirm: () => Promise<string>
}

type InnerProps = {
  onReadyChange: (ready: boolean) => void
}

const StripePaymentInner = forwardRef<UserReservationStripePaymentHandle, InnerProps>(
  function StripePaymentInner({ onReadyChange }, ref) {
    const stripe = useStripe()
    const elements = useElements()

    useImperativeHandle(
      ref,
      () => ({
        async confirm() {
          if (!stripe || !elements) {
            throw new Error("決済フォームの準備ができていません。")
          }
          const submit = await elements.submit()
          if (submit.error) {
            throw new Error(submit.error.message ?? "カード情報を確認してください。")
          }
          const returnUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`
          const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: "if_required",
            confirmParams: {
              return_url: returnUrl,
            },
          })
          if (error) {
            throw new Error(error.message ?? "決済に失敗しました。")
          }
          if (!paymentIntent?.id) {
            throw new Error("決済が完了しませんでした。")
          }
          return paymentIntent.id
        },
      }),
      [stripe, elements],
    )

    useEffect(() => {
      onReadyChange(Boolean(stripe && elements))
    }, [stripe, elements, onReadyChange])

    return (
      <div className="space-y-3">
        <PaymentElement />
      </div>
    )
  },
)

type Props = {
  clientSecret: string
  publishableKey: string
  amountYen: number
  onReadyChange: (ready: boolean) => void
}

export const UserReservationStripePayment = forwardRef<UserReservationStripePaymentHandle, Props>(
  function UserReservationStripePayment(
    { clientSecret, publishableKey, amountYen, onReadyChange },
    ref,
  ) {
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)

    useEffect(() => {
      setStripePromise(loadStripe(publishableKey))
    }, [publishableKey])

    if (!stripePromise) return null

    return (
      <div className="max-w-full space-y-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-xs font-semibold text-foreground">オンライン決済（クレジットカード）</p>
        <p className="text-sm font-medium text-foreground">ご請求額: ¥{amountYen.toLocaleString()}</p>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <StripePaymentInner ref={ref} onReadyChange={onReadyChange} />
        </Elements>
      </div>
    )
  },
)
