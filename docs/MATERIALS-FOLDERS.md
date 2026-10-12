# Materials folders and reading room

- `/dashboard/materials` groups materials a student saved from their Programme page into folders by course code.
- `/dashboard/materials/folder/:courseCode` lists the saved files in one course folder and supports reading, removing a saved item, and offline copies in the native app.
- `/dashboard/materials/library?m=<saveId>` opens the reading room with a folder/file list, an embedded viewer, download, AI practice, and previous/next navigation.

The shared save normalization and folder grouping live in `src/hooks/useMaterialSaves.js`. Course Reps publish a course or programme-scoped material from `/dashboard/course-rep`; students save it from `/dashboard/department` to make it available in My Materials.
