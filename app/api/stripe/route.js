import connectDB from "@/config/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16", // Always define this to avoid breaking changes
});

export const config = {
  api: {
    bodyParser: false, // ✅ Use correct casing
  },
};

export async function POST(request) {
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    const handlePaymentIntent = async (paymentIntentId, isPaid) => {
      const sessionList = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
      });

      const session = sessionList.data[0];
      if (!session || !session.metadata) {
        throw new Error("Session or metadata not found.");
      }

      const { orderId, userId } = session.metadata;

      await connectDB();

      if (isPaid) {
        await Order.findByIdAndUpdate(orderId, { isPaid: true });
        await User.findByIdAndUpdate(userId, { cartItems: {} });
      } else {
        await Order.findByIdAndUpdate(orderId, { isPaid: false });
      }
    };

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntent(event.data.object.id, true);
        break;

      case "payment_intent.canceled":
        await handlePaymentIntent(event.data.object.id, false);
        break;

      default:
        console.warn("Unhandled event type:", event.type);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe Webhook Error:", error);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }
}
