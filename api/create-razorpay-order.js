import Razorpay from "razorpay";

export default async function handler(req, res) {
  // ---------------------------------
  // ✅ CORS (VERY IMPORTANT)
  // ---------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle browser preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount } = req.body;

    // ---------------------------------
    // ✅ BASIC VALIDATION
    // ---------------------------------
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // ---------------------------------
    // ✅ CREATE RAZORPAY INSTANCE
    // ---------------------------------
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // ---------------------------------
    // ✅ CREATE RAZORPAY ORDER
    // ---------------------------------
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // INR → paise
      currency: "INR",
      receipt: `puja_${Date.now()}`
    });

    // ---------------------------------
    // ✅ RETURN ORDER ID TO FRONTEND
    // ---------------------------------
    return res.status(200).json({
      id: order.id
    });

  } catch (error) {
    console.error("Razorpay order creation failed:", error);
    return res.status(500).json({
      error: "Failed to create Razorpay order"
    });
  }
}
