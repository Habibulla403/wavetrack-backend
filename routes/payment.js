import express from "express";
import Stripe from "stripe";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  musician: {
    name: "Musician",
    monthly: process.env.STRIPE_MUSICIAN_MONTHLY_ID,
    annual:  process.env.STRIPE_MUSICIAN_ANNUAL_ID,
  },
  musician_plus: {
    name: "Musician Plus",
    monthly: process.env.STRIPE_PLUS_MONTHLY_ID,
    annual:  process.env.STRIPE_PLUS_ANNUAL_ID,
  },
  ultimate: {
    name: "Ultimate",
    monthly: process.env.STRIPE_ULTIMATE_MONTHLY_ID,
    annual:  process.env.STRIPE_ULTIMATE_ANNUAL_ID,
  },
};

// POST /api/payment/create-checkout
router.post("/create-checkout", protect, async (req, res) => {
  try {
    const { planId, billing } = req.body;
    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ message: "Invalid plan" });

    const priceId = billing === "annual" ? plan.annual : plan.monthly;
    if (!priceId) return res.status(400).json({ message: "Price ID not configured" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: req.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: {
        userId: req.user._id.toString(),
        planId,
        billing,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payment/webhook  (Stripe webhook)
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, planId } = session.metadata;
    await User.findByIdAndUpdate(userId, {
      plan: planId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    await User.findOneAndUpdate(
      { stripeSubscriptionId: sub.id },
      { plan: "free" }
    );
  }

  res.json({ received: true });
});

// GET /api/payment/status
router.get("/status", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("plan stripeSubscriptionId");
    let subscriptionStatus = null;
    if (user.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      subscriptionStatus = sub.status;
    }
    res.json({ plan: user.plan || "free", subscriptionStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payment/cancel
router.post("/cancel", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.stripeSubscriptionId) return res.status(400).json({ message: "No active subscription" });
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    await User.findByIdAndUpdate(req.user._id, { plan: "free", stripeSubscriptionId: null });
    res.json({ message: "Subscription cancelled" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
