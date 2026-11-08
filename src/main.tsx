import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource-variable/archivo/wdth.css";
import "./index.css";
import "./styles/wrapped.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

createRoot(rootElement).render(<App />);
