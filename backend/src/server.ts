import { app } from "./app.js";
import { jwtSecret } from "./lib/jwt.js";

// Fail fast: JWT_SECRET is required at runtime (never a built-in default).
jwtSecret();

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`habit-shaper backend listening on :${port}`);
});
