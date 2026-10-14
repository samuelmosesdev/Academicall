const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  // Keep this public web client ID in sync with Academicall-api/render.yaml.
  "307015602920-v39vhisv32vb15sjastrftuc3s4siq95.apps.googleusercontent.com";
const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let gisScriptPromise;

function loadGisScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise((resolve, reject) => {
    const script = document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`) || document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Sign-In did not load. Check your connection and try again."));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    }

    function onLoad() {
      cleanup();
      if (window.google?.accounts?.id) resolve();
      else reject(new Error("Google Sign-In loaded without its identity service. Please try again."));
    }

    function onError() {
      cleanup();
      reject(new Error("Could not load Google Sign-In. Check your connection and try again."));
    }

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!script.isConnected) {
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.google?.accounts?.id) {
      onLoad();
    }
  }).catch((error) => {
    gisScriptPromise = null;
    throw error;
  });

  return gisScriptPromise;
}

export async function renderGoogleSignInButton(element, onCredential, isActive = () => true) {
  if (!CLIENT_ID) {
    throw new Error("Google sign-in isn't configured (missing VITE_GOOGLE_CLIENT_ID).");
  }

  await loadGisScript();
  if (!element || !isActive()) return () => {};

  let active = true;
  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response) => {
      if (!active) return;
      if (response?.credential) {
        onCredential(response.credential);
      } else onCredential(null);
    },
  });
  window.google.accounts.id.renderButton(element, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    width: Math.min(400, Math.floor(element.getBoundingClientRect().width)),
  });

  return () => {
    active = false;
    element.replaceChildren();
  };
}
