import assert from "node:assert/strict";
import test from "node:test";
import { defaultMetadata, injectMetadata, metadataTags } from "./og.mjs";

test("injectMetadata replaces the marked metadata block", () => {
  const html = "<head><!-- og:start -->old tags<!-- og:end --></head>";
  const metadata = { ...defaultMetadata("/news/story"), title: "Story title" };

  const result = injectMetadata(html, metadata);

  assert.match(result, /<title>Story title<\/title>/);
  assert.doesNotMatch(result, /old tags/);
  assert.equal((result.match(/og:start/g) || []).length, 1);
});

test("metadata values are HTML-escaped", () => {
  const tags = metadataTags({
    ...defaultMetadata("/news/story"),
    title: '<script>alert("x")</script>',
  });

  assert.match(tags, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(tags, /<script>/);
});

test("article metadata includes optional article fields", () => {
  const tags = metadataTags({
    ...defaultMetadata("/news/story"),
    type: "article",
    publishedTime: "2026-10-16T12:00:00Z",
    author: "Academicall Desk",
    section: "Campus",
  });

  assert.match(tags, /article:published_time/);
  assert.match(tags, /article:author/);
  assert.match(tags, /article:section/);
});
