import crypto from "crypto";
import fetch from "node-fetch";
const SHOPIFY_GRAPHQL = `https://${process.env.SHOPIFY_SHOP}/admin/api/2024-01/graphql.json`;

export default async function handler(req, res) {
  try {
    // -------------------------------
    // ✅ CORS HEADERS (MUST BE FIRST)
    // -------------------------------
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // ✅ Handle preflight request
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // ❌ Block everything except POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }


    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      variantId,
      addons,
      dakshina,
      prasad,
      customer,
      formTotal
    } = req.body;

    // --------------------------------------------------
    // 1️⃣ VERIFY RAZORPAY SIGNATURE
    // --------------------------------------------------
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // --------------------------------------------------
    // 2️⃣ FETCH VARIANT PRICE FROM SHOPIFY
    // --------------------------------------------------
    const variantQuery = `
      query getVariant($id: ID!) {
        productVariant(id: $id) {
          price
          title
        }
      }
    `;

    const variantResp = await shopifyFetch(variantQuery, {
      id: `gid://shopify/ProductVariant/${variantId}`
    });

    const variantPrice = parseFloat(
      variantResp.data.productVariant.price
    );

    // --------------------------------------------------
    // 3️⃣ RE-CALCULATE TOTAL (SERVER-SIDE)
    // --------------------------------------------------
    let calculatedTotal = variantPrice;

    addons.forEach(a => calculatedTotal += a.price);
    calculatedTotal += dakshina;
    if (prasad) calculatedTotal += 30;

    if (calculatedTotal !== formTotal) {
      return res.status(400).json({
        error: "Amount mismatch detected",
        calculatedTotal,
        formTotal
      });
    }

    // --------------------------------------------------
    // 4️⃣ CREATE DRAFT ORDER
    // --------------------------------------------------
    const draftMutation = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
          }
          userErrors {
            message
          }
        }
      }
    `;

    const draftInput = {
      lineItems: [
        {
          variantId: `gid://shopify/ProductVariant/${variantId}`,
          quantity: 1
        }
      ],
      email: customer.email,
      phone: "+91" + customer.phone,
      note: `PAID VIA RAZORPAY\nPayment ID: ${razorpay_payment_id}`,
      tags: [
        "puja-booking",
        "razorpay-paid",
        `payment-${razorpay_payment_id}`
      ],
      customAttributes: [
        { key: "Name", value: customer.name },
        { key: "Phone", value: customer.phone },
        { key: "Gotra", value: customer.gotra },
        { key: "Wish", value: customer.wish }
      ],
      paymentPending: false
    };

    const draftResp = await shopifyFetch(draftMutation, { input: draftInput });

    const draftOrderId =
      draftResp.data.draftOrderCreate.draftOrder.id;

    // --------------------------------------------------
    // 5️⃣ COMPLETE DRAFT ORDER (REAL ORDER)
    // --------------------------------------------------
    const completeMutation = `
      mutation draftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id) {
          order {
            id
            name
          }
        }
      }
    `;

    const completeResp = await shopifyFetch(completeMutation, {
      id: draftOrderId
    });

    return res.status(200).json({
      success: true,
      orderName: completeResp.data.draftOrderComplete.order.name
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
}

// --------------------------------------------------
// SHOPIFY FETCH HELPER
// --------------------------------------------------
async function shopifyFetch(query, variables) {
  const res = await fetch(SHOPIFY_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN
    },
    body: JSON.stringify({ query, variables })
  });

  return res.json();
}
