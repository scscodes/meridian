import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const analyticsHtmlPaths = [
  path.resolve(__dirname, "../src/domains/git/analytics-ui/index.html"),
  path.resolve(__dirname, "../src/domains/hygiene/analytics-ui/index.html"),
];

function readHtml(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function getCspContent(html: string): string {
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  return match?.[1] ?? "";
}

describe("Webview security policy", () => {
  it("does not allow remote script URLs in analytics webviews", () => {
    for (const htmlPath of analyticsHtmlPaths) {
      const html = readHtml(htmlPath);
      expect(html).not.toMatch(/<script[^>]+src="https?:\/\//);
    }
  });

  it("uses local-only script sources in analytics webview CSP", () => {
    for (const htmlPath of analyticsHtmlPaths) {
      const csp = getCspContent(readHtml(htmlPath));
      expect(csp).toContain("script-src {{WEBVIEW_CSP_SOURCE}} 'nonce-{{NONCE}}'");
      expect(csp).not.toContain("https://cdn.jsdelivr.net");
    }
  });

  it("does not allow broad outbound connect in analytics webview CSP", () => {
    for (const htmlPath of analyticsHtmlPaths) {
      const csp = getCspContent(readHtml(htmlPath));
      expect(csp).toContain("connect-src 'none'");
      expect(csp).not.toContain("connect-src https:");
    }
  });
});
