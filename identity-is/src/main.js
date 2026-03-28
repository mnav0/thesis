import { createApp } from "vue";
import App from "./App.vue";
import { fetchAndParseData } from "./data/index.js";
import "./style.css";

fetchAndParseData();
createApp(App).mount("#app");
