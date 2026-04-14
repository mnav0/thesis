import * as d3 from "d3";
import { FONT_SANS } from "../../constants.js";

/**
 * Creates a D3-managed tooltip div inside `container` and returns
 * { tooltip, show, hide } helpers.
 *
 *   show(event, { bg, fg, border, html })
 *     – positions the tooltip near the cursor (relative to container)
 *       and sets its content / colours.
 *
 *   hide()
 *     – hides the tooltip.
 */
export function createTooltip(container) {
  const tooltip = d3
    .select(container)
    .append("div")
    .attr("class", "d3-tooltip")
    .style("position", "absolute")
    .style("background", "#fff")
    .style("border", "1px solid #222")
    .style("padding", "8px 12px")
    .style("font-family", FONT_SANS)
    .style("font-size", "1em")
    .style("pointer-events", "none")
    .style("display", "none")
    .style("max-width", "300px")
    .style("min-width", "150px")
    .style("z-index", 10000)
    .style("box-shadow", "0 2px 8px #0002")
    .style("white-space", "pre-line")
    .style("line-height", "1.35");

  function show(event, { bg, fg, border, html }) {
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    tooltip
      .style("display", null)
      .style("background", bg)
      .style("color", fg)
      .style("border-color", border)
      .html(html)
      .style("left", mouseX + 10 + "px")
      .style("top", mouseY + 10 + "px");
  }

  function hide() {
    tooltip.style("display", "none");
  }

  return { tooltip, show, hide };
}
