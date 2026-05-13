export function Popup() {
  return (
    <div className="popup">
      <div className="popup-logo">S</div>
      <h1 className="popup-title">No Clay components found</h1>
      <p className="popup-body">
        This page does not appear to be powered by Clay. Open a Clay page and click the toolbar icon
        to inspect components.
      </p>
      <a
        className="popup-link"
        href="https://github.com/clay/clay"
        target="_blank"
        rel="noreferrer noopener"
      >
        Learn about Clay →
      </a>
    </div>
  );
}
