import { createApp } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import App from "./App.vue";
import { fetchAndParseData } from "./data/index.js";
import "./style.css";
import "./styles/cluster-ui-label.css";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

fetchAndParseData();
createApp(App).mount("#app");
