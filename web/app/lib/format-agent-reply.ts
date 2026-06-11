/** Strip markdown / chat flourishes from OpenClaw replies for a clean UI. */
export function formatAgentReply(text: string): string {
  let out = text
    // headings: ## Title
    .replace(/^#{1,6}\s+/gm, "")
    // blockquotes: > line
    .replace(/^\s*>\s?/gm, "")
    // bold / italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // inline code
    .replace(/`([^`]+)`/g, "$1")
    // bullet / numbered list leaders
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    // horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // em dash / en dash as sentence break
    .replace(/\s*[—–]\s*/g, ". ")
    // decorative emoji (keep currency symbols etc.)
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      ""
    )
    // fix spacing after punctuation cleanup
    .replace(/\.\s*\./g, ".")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/  +/g, " ")
    .trim();

  // Capitalize first letter after leading cleanup
  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  return out;
}
