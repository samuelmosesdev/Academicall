# Materials folders and reading room

- `/dashboard/materials` groups materials a student saved from their Programme page into folders by course code.
- `/dashboard/materials/folder/:courseCode` lists the saved files in one course folder and supports reading, removing a saved item, and offline copies in the native app.
- `/dashboard/materials/library?m=<saveId>` opens the reading room with a folder/file list, download, AI practice, and previous/next navigation. PDFs use the in-app PDF.js reader with page navigation, fit/zoom, rotation, and fullscreen controls; other formats keep their existing embedded viewer.
- Premium students can upload personal study files from `/dashboard/materials`. These uploads are listed only in their Materials area and are excluded from the shared Reading Hub and Programme feeds.
- The same PDF.js reader is used by the document-reading route. Its worker is bundled with the app and PDF.js streams byte ranges where the file host supports them, reducing upfront downloads. If browser CORS or PDF parsing prevents in-app rendering, the reader provides a direct-open fallback.

The shared save normalization and folder grouping live in `src/hooks/useMaterialSaves.js`. Course Reps can publish assigned-program courses and programme-scoped materials from `/dashboard/course-rep`; students save those shared materials from `/dashboard/department` to make them available in My Materials.
