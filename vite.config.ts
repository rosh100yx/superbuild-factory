import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
// Note: `agents/vite` default-exports the plugin in agents@0.24, it is NOT a named export.
import agents from "agents/vite";

export default defineConfig({
  plugins: [react(), cloudflare(), ...agents()],
});
