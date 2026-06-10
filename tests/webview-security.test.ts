import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const webviewHtmlPaths = [
  path.resolve(__dirname, "../src/domains/git/analytics-ui/index.html"),
  path.resolve(__dirname, "../src/domains/git/session-briefing-ui/index.html"),
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
  it("does not allow remote script URLs in webviews", () => {
    for (const htmlPath of webviewHtmlPaths) {
      const html = readHtml(htmlPath);
      expect(html).not.toMatch(/<script[^>]+src="https?:\/\//);
    }
  });

  it("uses nonce-only script sources in webview CSP", () => {
    for (const htmlPath of webviewHtmlPaths) {
      const csp = getCspContent(readHtml(htmlPath));
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("script-src 'nonce-{{NONCE}}'");
      expect(csp).not.toContain("unsafe-eval");
      expect(csp).not.toContain("https://cdn.jsdelivr.net");
    }
  });

  it("requires a nonce on every script tag", () => {
    for (const htmlPath of webviewHtmlPaths) {
      const html = readHtml(htmlPath);
      const scriptTags = html.match(/<script[^>]*>/g) ?? [];
      expect(scriptTags.length).toBeGreaterThan(0);
      for (const tag of scriptTags) {
        expect(tag).toContain('nonce="{{NONCE}}"');
      }
    }
  });

  it("does not allow broad outbound connect or remote images in webview CSP", () => {
    for (const htmlPath of webviewHtmlPaths) {
      const csp = getCspContent(readHtml(htmlPath));
      expect(csp).toContain("connect-src 'none'");
      expect(csp).not.toContain("connect-src https:");
      expect(csp).not.toMatch(/img-src[^;]*https:/);
    }
  });
});
