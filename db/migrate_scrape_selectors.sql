-- Migration: Add scrape_selectors and date_selectors for existing sources
-- This enables full-article scraping when RSS content is thin (<200 chars)

UPDATE sources SET scrape_selector = 'article',                        date_selector = 'time[datetime]' WHERE domain = 'bbc.com'         AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '[id="maincontent"]',             date_selector = 'time[datetime]' WHERE domain = 'theguardian.com' AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.article__body',                 date_selector = 'time[datetime]' WHERE domain = 'rnz.co.nz'      AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.sics-component__story',         date_selector = 'time[datetime]' WHERE domain = 'stuff.co.nz'    AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '[data-component="BodyContent"]', date_selector = 'time[datetime]' WHERE domain = 'abc.net.au'     AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = 'article',                        date_selector = 'time[datetime]' WHERE domain = 'smh.com.au'     AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.wysiwyg',                       date_selector = 'time[datetime]' WHERE domain = 'aljazeera.com'  AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.article-body__content',         date_selector = 'time[datetime]' WHERE domain = 'nbcnews.com'    AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.article-content',               date_selector = 'time[datetime]' WHERE domain = 'arstechnica.com' AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '#article-body',                  date_selector = 'time[datetime]' WHERE domain = 'theregister.com' AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.article-body',                  date_selector = 'time[datetime]' WHERE domain = 'theverge.com'   AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.article__body',                 date_selector = 'time[datetime]' WHERE domain = 'wired.com'      AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.entry-content',                 date_selector = 'time[datetime]' WHERE domain = 'servethehome.com' AND scrape_selector IS NULL;
UPDATE sources SET scrape_selector = '.entry-content',                 date_selector = 'time[datetime]' WHERE domain = 'storagereview.com' AND scrape_selector IS NULL;
