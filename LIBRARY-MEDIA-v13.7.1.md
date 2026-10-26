# Open books and educational videos — v13.7.1

The original library searched OpenAlex only, with one relevance-ranked result set, so articles dominated and video discovery was absent.

All resources now searches four independent sources/format groups and interleaves their results: OpenAlex articles, OpenAlex open books, OpenStax textbooks and selected educational video collections on Internet Archive. The Document type selector includes book and video. Specific article/dissertation/preprint/book-chapter searches continue using OpenAlex. Books searches OpenAlex and OpenStax. Video searches Internet Archive only.

Video queries are limited to MIT OpenCourseWare, Khan Academy, NPTEL and EuroPython collections. Returned records must declare a recognised Creative Commons licence or public-domain status. The library links to the original page, which can contain a whole course playlist. It does not host, download or relicense videos. OpenStax results link to the textbook page and display a reminder to check its licence.

Publication-year filters are sent to OpenAlex and Internet Archive. OpenStax is omitted with a visible explanation when a year is selected because the selected API fields do not establish a reliable book publication year.

If a provider fails, other sources remain available and the page shows a source-specific warning. Incomplete result sets are not cached. Successful searches use a new versioned cache key, avoiding old article-only cached results. Each actual provider call consumes one daily request. All resources uses up to four calls, books up to two and videos one. Existing administrator controls and per-account limits apply across providers.

Pages, search APIs, bookshelves and course readings retain their sign-in and course-audience checks. No public homepage link or paid service is added. DOAB/OAPEN are not advertised as integrated because their REST endpoints returned HTTP 403 during verification. No YouTube scraping or API credential is required.
