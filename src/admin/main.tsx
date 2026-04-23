import { createRoot } from "react-dom/client";
import { AdminApp } from "./AdminApp";

function start() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<AdminApp />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
