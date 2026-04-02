import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.DEV) {
	console.info("[DiscogsDecks] Frontend mounted (dev)");
}

createRoot(document.getElementById("root")!).render(<App />);
