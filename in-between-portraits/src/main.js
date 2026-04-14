import { createApp } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import App from "./App.vue";
import { fetchAndParseData } from "./data/index.js";
import { installScrollRestoreListeners } from "./utils/scroll-app-animations.js";
import "./style.css";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

installScrollRestoreListeners();
fetchAndParseData();
createApp(App).mount("#app");
