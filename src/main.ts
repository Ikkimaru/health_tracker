import "./styles.css";
import { IndexedDbRepository } from "./infrastructure/indexedDb";
import { HealthQuestApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Application root is missing");
void new HealthQuestApp(root, new IndexedDbRepository()).start();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener(
    "load",
    () => void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  );
}
