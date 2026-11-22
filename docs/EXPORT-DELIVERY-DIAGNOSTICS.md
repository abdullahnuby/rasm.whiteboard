# Export delivery and on-device diagnostics

Release identifier shown in the export panel: `2026-11-22-delivery-2`.

The actual iPhone report remains the acceptance check. Desktop WebKit and a narrow Chromium viewport are not iPhone Safari tests.

## Delivery

Encoding does not open a save sheet automatically. After completion, the panel explicitly asks the user to choose a save method. A new tap is needed because the original export tap's transient activation expires during encoding.

When `navigator.share`, `navigator.canShare({files})`, and `File` support the completed video, a prominent **حفظ أو مشاركة الفيديو** button calls file sharing directly within that new click. No asynchronous work precedes the share call. There is no user-agent branch. Desktop's existing download links remain available and unchanged.

A resolved share promise is recorded as share-resolved. Its precise meaning varies by platform and it does not prove the user saved a file. Cancellation, rejection and synchronous errors preserve the file, enable retry and explain the fallback.

**فتح الفيديو في نافذة للحفظ** is a normal user-activated blob link with `target=_blank`, without `download`, and with `rel=noopener`. It exposes the video to the browser's native viewer. Instructions explain sharing from there to Photos or Files. Whether that viewer can save the selected container depends on the device. The inline preview and download link remain available.

## Diagnostics

The export panel exposes a text log from the beginning, not only on failures. It records feature availability, selected engine and format, coarse progress, Blob size/type, output inspection and actual codecs, preview errors, and delivery attempts/results. A short summary keeps engine, Blob and latest stage visible without scrolling through JSON. It contains no scene image or narration bytes and makes no network requests.

The log can be copied. If clipboard permission is blocked, the text is selected for manual copying; the user can always take a screenshot. The existing downloadable JSON compatibility report includes the same delivery log. A bounded 30-second output-inspection timeout prevents a completed encoder from leaving an unbounded verification wait.

## Validation

- Full build and existing regression suite pass, including eleven new delivery unit tests.
- Seven real export/codec cases pass with downloaded files checked by FFprobe, including desktop WebKit narration.
- Narrow touch Chromium tests use an actual encoded MP4 and simulated Web Share responses. They cover fresh user activation, no automatic sharing, success without a false saved claim, cancellation, permission rejection, unsupported/throwing canShare, a real visible blob viewer tab and clipboard refusal.
- Native iOS share-sheet display and saving to Photos/Files still require the user's real iPhone test. Simulated share responses do not prove those OS behaviors.

API references inspected:
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare
