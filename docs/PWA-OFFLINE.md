# Offline browser installation

This is the browser editor with an offline shell, not a native APK or EXE. Native encoder support and real-device acceptance remain unfinished.

## Prepare

1. Build with `npm ci && npm run build` and serve `dist/` over HTTPS or localhost. Do not open `index.html` using `file://`.
2. Open the editor online once. In project management, wait for the offline-ready status. Core assets total about 2.01 MB uncompressed, excluding optional inference assets and model weights.
3. On a supported browser, use the install button in project management or the browser's own install menu. It is still possible to use the editor without installation.
4. For offline model proposals, explicitly install the two documented ONNX files. This also prepares the separate 11.98 MB local runtime. The 44.66 MB model weights remain in the existing IndexedDB model store. They are not duplicated in Cache Storage or included in these distributions.

A service worker cannot promise permanent storage. Browser cleanup, storage eviction or removing the browser profile can remove the app cache, models and projects. Keep `.rasm` backups. Asset sizes are not RAM or installed APK/EXE measurements.

## iPhone and iPad Home Screen installation

Open the HTTPS app URL in Safari, not a messaging app's internal browser. First download a `.rasm` project backup. Use Share (or Page Menu, then Share), choose Add to Home Screen, enable Open as Web App if that option is shown, then tap Add. If Add to Home Screen is missing, look in Edit Actions. Launch the new icon online once and wait for the offline-ready status before depending on offline use. If the project does not appear, open its backup in the installed app. Do not delete the original until the backup opens correctly.

The editor provides these steps inside Project management on iPhone/iPad, without waiting for a browser installation prompt. It includes an opaque 180px Apple touch icon, Apple standalone metadata, a standalone manifest, safe-area padding and touch-size installation controls. The installation guidance is hidden when the app is already standalone. Platform detection only chooses guidance, not encoder capabilities.

Keep the app foregrounded and the screen awake during analysis and export. Home Screen installation does not add native encoders or guarantee background processing. Safari's local storage remains subject to the system's storage policy. An explicit storage-persistence button requests better protection where the Storage API exists, reports refusal or failure accurately, and never treats persistence as a backup.

On resume, the UI checks the active worker's actual fixed core cache instead of treating registration alone as proof of offline readiness. Missing assets produce a warning without reloading or clearing the open project. Update waiting is still respected. The deployment sends no-cache headers for the worker script and manifest; registration bypasses HTTP cache for worker update checks. No forced activation, automatic page reload, background polling or image upload is added.

Primary platform references:

- [Apple: turn a website into an app on iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)
- [WebKit: Home Screen manifests and Apple touch icons](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [WebKit: storage quotas, eviction and persistence](https://webkit.org/blog/14403/updates-to-storage-policy/)

## Cache and updates

The generated service worker caches a fixed list of same-origin static app assets. It does not intercept uploads, model-weight URLs, user-image URLs, API requests, query-bearing requests or other origins. Optional runtime files are cached only when requested. Cache names are scoped to this installation URL; cleanup does not delete another installation's static cache or any project/model IndexedDB stores.

An update waits while an old app window remains open. There is no automatic reload under an open project. Close all app windows and reopen to use the new version. The status in project management reports a waiting update.

`npm run build` generates a content-hashed `service-worker.js` and `offline-cache.json`, then runs cache contracts. Do not edit generated files. New source assets are included by the generator; optional runtime paths remain explicit. An interrupted or failed cache installation does not replace a working active version.

## Verified in desktop Chrome 157

- Offline page reload and first image import, worker analysis, project autosave/reload.
- First-use offline H.264 MP4 export, including the dynamically imported muxer.
- Fully offline optional WASM inference after preparation, 26 tree-image proposals in 26.8 to 28.2 seconds, with no off-origin requests or page exceptions.
- Normal-profile manifest/installability checks with no errors. A private test context separately reports the expected private-mode installation restriction.
- A two-version update that left the open project untouched, then restored its saved scene after old windows closed and the new version opened.
- Desktop, 320px and 390px project-management layout; app icon and update-state screenshots inspected.
- Static cache allowlists, scope isolation, optional runtime separation and preservation of unrelated caches.
- Installation support does not replace or shadow the existing offline video encoder.
- iPhone/iPad guidance, Safari and display-mode standalone detection, installation-event fallback, storage acceptance/refusal/error, Apple metadata and actual core-cache loss have automated regression checks.
- A desktop Chromium iPhone UI profile at 320/390px verifies scrollable installation instructions, no horizontal overflow, offline import/save/reload and hidden installation controls in standalone mode. The screenshots were inspected. This is not actual Safari or an iPhone installation.

Actual iPhone/iPad/Android/Windows OS installation, Safari codecs, mobile memory, native codecs and device battery use have not been tested. The browser's codec limits still apply. This shell does not make unsupported AAC encoding available.
