import React from "react";
import { createRoot } from "react-dom/client";
import { PriceMatrixWidget } from "../src/index";

// Configure these values for your environment
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9292";
const API_KEY = import.meta.env.VITE_API_KEY || "your-api-key-here";
const PRODUCT_ID = import.meta.env.VITE_PRODUCT_ID || "your-product-id-here";

// Default widget
createRoot(document.getElementById("widget-default")!).render(
  <PriceMatrixWidget
    apiUrl={API_URL}
    apiKey={API_KEY}
    productId={PRODUCT_ID}
    onAddToCart={(event) => {
      console.log("Add to cart event:", event);
      alert(
        `Draft Order created!\n\nOrder ID: ${event.draftOrderId}\nPrice: ${event.price}\nTotal: ${event.total}\nCheckout: ${event.checkoutUrl}`,
      );
    }}
  />,
);

// Themed widget
createRoot(document.getElementById("widget-themed")!).render(
  <PriceMatrixWidget
    apiUrl={API_URL}
    apiKey={API_KEY}
    productId={PRODUCT_ID}
    theme={{
      primaryColor: "#e63946",
      textColor: "#1d3557",
      borderColor: "#a8dadc",
      borderRadius: "12px",
      fontSize: "15px",
    }}
    onAddToCart={(event) => {
      console.log("Themed widget - Add to cart:", event);
    }}
  />,
);
