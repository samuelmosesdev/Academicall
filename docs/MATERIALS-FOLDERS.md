# Materials folders and reading room

- `/dashboard/materials` groups materials a student saved from their Programme page into folders by course code.
- `/dashboard/materials/folder/:courseCode` lists the saved files in one course folder and supports reading, removing a saved item, and offline copies in the native app.
- `/dashboard/materials/library?m=<saveId>` opens the reading room with a folder/file list, download, AI practice, and previous/next navigation. PDFs use the in-app PDF.js reader with page navigation, fit/zoom, rotation, and fullscreen controls; other formats keep their existing embedded viewer.
- The same PDF.js reader is used by the document-reading route. Its worker is bundled with the app and PDF.js streams byte ranges where the file host supports them, reducing upfront downloads. If browser CORS or PDF parsing prevents in-app rendering, the reader provides a direct-open fallback.

The shared save normalization and folder grouping live in `src/hooks/useMaterialSaves.js`. Course Reps publish a course or programme-scoped material from `/dashboard/course-rep`; students save it from `/dashboard/department` to make it available in My Materials.
