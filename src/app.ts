import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Always allow local Vite/dev servers (any port)
      const isLocal =
        !!origin &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      const configured =
        process.env.CORS_ORIGIN?.split(",")
          .map((item) => item.trim())
          .filter(Boolean) || [];

      // No origin (curl / mobile / same-origin) → allow
      // Localhost → allow
      // Empty CORS_ORIGIN → allow all (useful while debugging)
      // Origin is in the allow-list → allow
      if (!origin || isLocal || configured.length === 0 || configured.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  express.json({
    limit: "2mb",
    // Paystack (and similar webhook) signatures are computed over the raw
    // request body, so we stash it here instead of re-serializing req.body.
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use("/api/v1", routes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
    });
  }
);

export default app;
