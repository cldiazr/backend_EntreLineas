import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./src/routes/auth.routes.js";
import productRoutes from "./src/routes/product.routes.js";
import recipeRoutes from "./src/routes/recipe.routes.js";
import inventoryRoutes from "./src/routes/inventory.routes.js";
import walletRoutes from "./src/routes/wallet.routes.js";
import saleBatchRoutes from "./src/routes/saleBatch.routes.js";
import saleRoutes from "./src/routes/sale.routes.js";
import inventoryPurchaseRoutes from "./src/routes/inventoryPurchase.routes.js";
import exchangeRateRoutes from "./src/routes/exchangeRate.routes.js";
import commissionPresetRoutes from "./src/routes/commissionPreset.routes.js";
import conversionRoutes from "./src/routes/conversion.routes.js";
import dashboardRoutes from "./src/routes/dashboard.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import roleRoutes from "./src/routes/role.routes.js";
import { notFound, errorHandler } from "./src/middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",");
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/sale-batches", saleBatchRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/inventory-purchases", inventoryPurchaseRoutes);
app.use("/api/exchange-rates", exchangeRateRoutes);
app.use("/api/commission-presets", commissionPresetRoutes);
app.use("/api/conversions", conversionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API EntreLíneas corriendo en http://localhost:${PORT}`);
});
