/**
 * Unit tests for the classifier's fetch helpers and trope detector.
 * Run with: npm test
 *
 * Uses Node's built-in test runner (node:test) — no extra dependencies.
 * All tested functions are pure (no network, no DB) so no mocking needed.
 */

import { describe, it } from 'node:test';
import assert            from 'node:assert/strict';

// ts-node compiles to CJS, so we use require for cross-file imports.
// The `as typeof import(...)` casts give us type-checking.
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  _isSafeUrl,
  _stripHtml,
  determineOutcome,
  hasArticleQuality,
} = require('../index') as typeof import('../index') & {
  _isSafeUrl: (url: string) => boolean;
  _stripHtml: (html: string) => string;
};

const { detectTropes } =
  require('../bias') as typeof import('../bias');

// ---------------------------------------------------------------------------
// isSafeUrl
// ---------------------------------------------------------------------------
describe('isSafeUrl', () => {
  const BLOCKED = [
    'http://127.0.0.1/secret',
    'http://localhost/api',
    'http://10.0.0.1/admin',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',   // AWS IMDS
    'http://172.20.0.5/internal',                 // docker bridge
    'ftp://example.com/file',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not-a-url-at-all',
  ];

  const ALLOWED = [
    'https://www.nzherald.co.nz/article/123',
    'http://feeds.ars-technica.com/arstechnica/index',
    'https://techcrunch.com/2026/01/01/story/',
  ];

  it('blocks private/internal addresses', () => {
    for (const url of BLOCKED) {
      assert.equal(_isSafeUrl(url), false, `Expected ${url} to be blocked`);
    }
  });

  it('allows legitimate public URLs', () => {
    for (const url of ALLOWED) {
      assert.equal(_isSafeUrl(url), true, `Expected ${url} to be allowed`);
    }
  });
});

// ---------------------------------------------------------------------------
// stripHtml
// ---------------------------------------------------------------------------
describe('stripHtml', () => {
  it('removes script and style blocks entirely', () => {
    const html = '<p>Hello</p><script>alert("xss")</script><style>body{color:red}</style><p>World</p>';
    const result = _stripHtml(html);
    assert.ok(!result.includes('alert'),    'script content should be removed');
    assert.ok(!result.includes('color:red'),'style content should be removed');
    assert.ok(result.includes('Hello'),     'text content should survive');
    assert.ok(result.includes('World'),     'text content should survive');
  });

  it('decodes common HTML entities', () => {
    const html = '<p>AT&amp;T &lt;3 &quot;quotes&quot;</p>';
    const result = _stripHtml(html);
    assert.ok(result.includes('AT&T'),      '&amp; should decode to &');
    assert.ok(result.includes('<3'),        '&lt; should decode to <');
    assert.ok(result.includes('"quotes"'), '&quot; should decode to "');
  });

  it('collapses multiple whitespace to single space', () => {
    const html = '<p>  lots   of   space  </p>';
    const result = _stripHtml(html);
    assert.ok(!/ {2,}/.test(result), 'multiple spaces should be collapsed');
  });
});

// ---------------------------------------------------------------------------
// determineOutcome — pure function, no network needed
// ---------------------------------------------------------------------------
describe('determineOutcome', () => {
  const ARTICLE = [
    'The government announced a sweeping overhaul of the country\'s immigration policy on Monday,',
    'drawing immediate criticism from opposition parties and advocacy groups.',
    'The prime minister said the changes were necessary to address record levels of net migration.',
    'Critics argued the measures were rushed and would harm vulnerable communities.',
    'The bill is expected to pass parliament later this week with a narrow majority.',
  ].join(' ');

  it('returns ok for 200 with real article content',  () => assert.equal(determineOutcome(200, ARTICLE), 'ok'));
  it('returns blocked for 403',                        () => assert.equal(determineOutcome(403, ''), 'blocked'));
  it('returns blocked for 401',                        () => assert.equal(determineOutcome(401, ''), 'blocked'));
  it('returns ratelimited for 429',                    () => assert.equal(determineOutcome(429, ''), 'ratelimited'));
  it('returns paywall for 402',                        () => assert.equal(determineOutcome(402, ''), 'paywall'));
  it('returns paywall for 451 (legal block)',           () => assert.equal(determineOutcome(451, ''), 'paywall'));
  it('returns error for 5xx',                          () => {
    assert.equal(determineOutcome(500, ''), 'error');
    assert.equal(determineOutcome(503, ''), 'error');
  });

  it('returns soft-block when stripped text is under 150 chars', () =>
    assert.equal(determineOutcome(200, 'Too short.'), 'soft-block'));

  it('detects Cloudflare interstitial', () => {
    const page = ('Just a moment... Checking your browser before accessing. ' +
      'Please enable JavaScript. Cloudflare Ray ID: abc123 ').repeat(3);
    assert.equal(determineOutcome(200, page), 'soft-block');
  });

  it('detects subscription paywall prompt', () => {
    const page = ('Subscribe now for access to premium content. ' +
      'Sign in to read the full article. Create a free account to access all our stories.').repeat(2);
    assert.equal(determineOutcome(200, page), 'soft-block');
  });

  it('detects cookie consent wall', () => {
    const page = ('Please enable cookies to continue. This site requires cookies to function correctly. ' +
      'Please enable cookies in your browser settings so we can serve you.').repeat(2);
    assert.equal(determineOutcome(200, page), 'soft-block');
  });

  it('detects CAPTCHA / human verification challenge', () => {
    const page = ('Please verify you are human to access this content. ' +
      'Verify you are not a robot to continue reading the page.').repeat(3);
    assert.equal(determineOutcome(200, page), 'soft-block');
  });
});

// ---------------------------------------------------------------------------
// hasArticleQuality — content quality heuristic
// ---------------------------------------------------------------------------
describe('hasArticleQuality', () => {
  const ARTICLE = [
    'The government announced a sweeping overhaul of the country\'s immigration policy on Monday,',
    'drawing immediate criticism from opposition parties and advocacy groups.',
    'The prime minister said the changes were necessary to address record levels of net migration.',
    'Critics argued the measures were rushed and would harm vulnerable communities.',
    'The bill is expected to pass parliament later this week with a narrow majority.',
  ].join(' ');

  it('accepts real article prose', () =>
    assert.equal(hasArticleQuality(ARTICLE), true));

  it('rejects navigation menu boilerplate (repetitive short words)', () => {
    // Simulates stripped nav: "Home About Contact Sign In Sign Up" repeated
    const nav = 'Home About Contact Sign In Sign Up News Sports Tech Business'.repeat(8);
    assert.equal(hasArticleQuality(nav), false);
  });

  it('rejects cookie-banner / repeated identical phrases (low unique-word ratio)', () => {
    const banner = 'We use cookies to improve your experience on our website.';
    assert.equal(hasArticleQuality(banner.repeat(10)), false);
  });

  it('rejects text with too few words (under 40)', () => {
    assert.equal(hasArticleQuality('Breaking. A fire broke out downtown today.'), false);
  });

  it('rejects text with no sentence-ending punctuation', () => {
    // Looks like a tag cloud or heading list — long enough but no sentences
    const tagCloud = 'technology politics science health economy sport culture environment';
    assert.equal(hasArticleQuality(tagCloud.repeat(8)), false);
  });

  it('accepts longer articles with high word variety', () => {
    const text = [
      'Scientists at the University of Auckland have developed a new method for detecting microplastics in freshwater.',
      'The technique uses a modified spectrometer combined with machine learning to identify particles as small as one micron.',
      'Lead researcher Dr Sarah Kim said the breakthrough could transform environmental monitoring worldwide.',
      'Traditional methods require laboratory analysis taking days; the new approach delivers results in under an hour.',
      'Funding for the project came from the Ministry for the Environment and a private foundation.',
    ].join(' ');
    assert.equal(hasArticleQuality(text), true);
  });
});

// ---------------------------------------------------------------------------
// detectTropes
// ---------------------------------------------------------------------------
describe('detectTropes', () => {
  it('scores 0 for empty or very short text', () => {
    assert.equal(detectTropes(''), 0);
    assert.equal(detectTropes('hi'), 0);
  });

  it('scores 0 for clean plain news writing', () => {
    const news = 'The prime minister announced a new transport policy on Tuesday. ' +
      'The bill passed with 72 votes in favour. Opposition parties said they would review the legislation.';
    assert.equal(detectTropes(news), 0);
  });

  it('detects "delve" and AI vocabulary family', () => {
    const text = 'Let us delve into the robust framework and leverage our synergies to streamline the workflow.';
    assert.ok(detectTropes(text) > 0);
  });

  it('detects "it\'s worth noting" filler transitions', () => {
    assert.ok(detectTropes("It's worth noting that this has wider implications.") > 0);
    assert.ok(detectTropes("Importantly, we must therefore consider the broader context.") > 0);
  });

  it('detects signposted conclusions', () => {
    assert.ok(detectTropes('In conclusion, the evidence clearly shows a pattern.') > 0);
    assert.ok(detectTropes('To sum up, we have explored three key themes today.') > 0);
  });

  it('detects "Here\'s the kicker" fake suspense', () => {
    assert.ok(detectTropes("Here's the kicker: nobody saw it coming.") > 0);
    assert.ok(detectTropes("Here's the thing about modern AI adoption rates.") > 0);
  });

  it('detects "despite its challenges" formula', () => {
    assert.ok(detectTropes('Despite these challenges, the initiative continues to thrive.') > 0);
    assert.ok(detectTropes('Despite its limitations, the framework remains popular.') > 0);
  });

  it('scores higher when more trope categories fire', () => {
    const few  = 'Let us delve into the details.';
    const many = "Let us delve into this robust ecosystem. Here's the kicker: " +
      "it's worth noting that, in conclusion, despite these challenges, we must leverage " +
      "our synergies to fundamentally reshape the landscape.";
    assert.ok(detectTropes(many) > detectTropes(few));
  });

  it('always returns a value between 0 and 100', () => {
    const worst = "delve leverage robust streamline synergy tapestry paradigm ecosystem " +
      "harness utilize certainly serves as it's worth noting highlighting its " +
      "here's the kicker think of it as imagine a world and yes, the reality is simpler " +
      "fundamentally reshape let's break this down experts argue despite these challenges " +
      "in conclusion the first wall they assume that they assume";
    const score = detectTropes(worst);
    assert.ok(score >= 0 && score <= 100, `score ${score} out of expected range`);
  });
});
