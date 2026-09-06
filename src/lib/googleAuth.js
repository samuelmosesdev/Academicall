// Google Sign-In without Firebase Auth, using Google Identity Services (GIS).
// The GIS script tag is loaded in index.html:
//   <script src="https://accounts.google.com/gsi/client" async defer></script>
//
// This returns a Google ID token credential which is sent straight to the
// Academicall API's /auth/google endpoint (see src/lib/api.js -> authApi.google),
// which verifies it server-side with google-auth-library. No Firebase project
// or Firebase Admin credentials are needed for this flow.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function loadGisScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

/**
 * Opens the Google One Tap / popup sign-in flow and resolves with the raw
 * ID token credential string (a JWT) to send to the API.
 */
export function signInWithGoogleIdentity() {
  if (!CLIENT_ID) {
    return Promise.reject(new Error("Google sign-in isn't configured (missing VITE_GOOGLE_CLIENT_ID)."));
  }

  return loadGisScript().then(
    () =>
      new Promise((resolve, reject) => {
        try {
          window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response) => {
              if (response?.credential) {
                resolve(response.credential);
              } else {
                reject(new Error("Google sign-in was cancelled or returned no credential."));
              }
            },
          });

          // Use the popup-based One Tap prompt. If it's dismissed/skipped
          // (e.g. blocked by browser settings), surface a clear error so the
          // UI can let the person retry instead of hanging forever.
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
              reject(new Error("Google sign-in popup was blocked or dismissed. Please try again."));
            }
          });
        } catch (err) {
          reject(err);
        }
      })
  );
}
