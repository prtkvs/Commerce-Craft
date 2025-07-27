export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import Order from "@/models/Order";
import Product from "@/models/Product";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    // Only call getAuth inside function, not at file/module top level
    const { userId } = getAuth(request);

    const { address, items } = await request.json();
    const origin = request.headers.get("origin");

    if (!address || items.length === 0) {
      return NextResponse.json({ success: false, message: "Invalid data" });
    }

    let productData = [];
    let amount = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      productData.push({
        name: product.name,
        price: product.offerPrice,
        quantity: item.quantity,
      });

      amount += product.offerPrice * item.quantity;
    }

    amount += Math.floor(amount * 0.02);

    const order = await Order.create({
      userId,
      address,
      items,
      amount,
      date: Date.now(),
      paymentType: "Stripe",
    });

    const line_items = productData.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
        },
        unit_amount: item.price * 100,
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      success_url: `${origin}/order-placed`,
      cancel_url: `${origin}/cart`,
      metadata: {
        orderId: order._id.toString(),
        userId,
      },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json({ success: false, message: error.message });
  }
}
