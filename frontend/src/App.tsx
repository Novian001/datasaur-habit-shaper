import { useEffect, useState } from "react";

type Health = { status: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: Health) => setHealth(data))
      .catch(() => setError(true));
  }, []);

  const apiState =
    error ? "Unreachable"
    : health ? (health.status === "ok" ? "Healthy" : health.status)
    : "Checking…";

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Habit Shaper</h1>
      <p>Application foundation is running.</p>
      <p>
        API status: <strong>{apiState}</strong>
      </p>
    </main>
  );
}
