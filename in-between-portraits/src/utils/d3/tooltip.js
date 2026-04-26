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
  const mountTarget = document.body ?? container;
  const tooltip = d3
    .select(mountTarget)
    .append("div")
    .attr("class", "d3-tooltip")
    .style("position", "fixed")
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
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const offset = 10;

    tooltip
      .style("display", null)
      .style("background", bg)
      .style("color", fg)
      .style("border-color", border)
      .html(html);

    const tooltipNode = tooltip.node();
    if (!tooltipNode) return;
    const tooltipRect = tooltipNode.getBoundingClientRect();

    let left = mouseX + offset;
    let top = mouseY + offset;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const spaceRight = viewportW - (mouseX + offset);
    const spaceBelow = viewportH - (mouseY + offset);

    if (spaceRight < tooltipRect.width + offset) {
      left = mouseX - tooltipRect.width - offset;
    }
    if (spaceBelow < tooltipRect.height + offset) {
      top = mouseY - tooltipRect.height - offset;
    }

    // Final clamping so tooltip stays fully inside container bounds.
    left = Math.max(offset, Math.min(left, viewportW - tooltipRect.width - offset));
    top = Math.max(offset, Math.min(top, viewportH - tooltipRect.height - offset));

    tooltip.style("left", left + "px").style("top", top + "px");
  }

  function hide() {
    tooltip.style("display", "none");
  }

  function destroy() {
    tooltip.remove();
  }

  return { tooltip, show, hide, destroy };
}
