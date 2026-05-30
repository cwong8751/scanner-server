import { useState, useEffect, useRef } from 'react';
import './App.css';

function ScanCard({ entry }) {
  const { timestamp, barcode, image, raw } = entry;

  return (
    <li className="scan-entry">
      <span className="scan-time">{timestamp}</span>

      {/* Barcode */}
      {barcode != null && (
        <div className="scan-barcode">
          <span className="scan-label">barcode</span>
          <span className="scan-barcode-value">{barcode}</span>
        </div>
      )}

      {/* Image */}
      {image != null && (
        <img
          src={image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`}
          alt="Scanned"
          className="scan-image"
        />
      )}

      {/* Fallback: raw payload */}
      {raw != null && (
        <pre className="scan-payload">{JSON.stringify(raw, null, 2)}</pre>
      )}
    </li>
  );
}

function parseScanData(data) {
  if (data && typeof data === 'object') {
    if ('barcode' in data) {
      return { type: 'barcode', value: String(data.barcode).trim() };
    }
    if ('image' in data) {
      return { type: 'image', value: data.image };
    }
  }
  return { type: 'raw', value: data };
}

export default function App() {
  const [qrData, setQrData] = useState(null);
  const [scanEntries, setScanEntries] = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [restarting, setRestarting] = useState(false);
  const eventSourceRef = useRef(null);

  async function fetchQr() {
    const res = await fetch('/qr');
    const data = await res.json();
    setQrData(data);
  }

  function connectEvents() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new EventSource('/events');

    es.addEventListener('scan-data', (e) => {
      const data = JSON.parse(e.data);
      const parsed = parseScanData(data);
      const timestamp = new Date().toLocaleTimeString();

      setScanEntries((prev) => {
        // If incoming is an image and the newest card has a barcode but no image yet — merge
        if (parsed.type === 'image' && prev.length > 0 && prev[0].barcode != null && prev[0].image == null) {
          const [newest, ...rest] = prev;
          return [{ ...newest, image: parsed.value }, ...rest];
        }

        const newEntry = { id: Date.now(), timestamp };
        if (parsed.type === 'barcode') newEntry.barcode = parsed.value;
        else if (parsed.type === 'image') newEntry.image = parsed.value;
        else newEntry.raw = parsed.value;

        return [newEntry, ...prev];
      });
    });

    es.addEventListener('log', (e) => {
      const { message, timestamp } = JSON.parse(e.data);
      setLogEntries((prev) => [
        { id: Date.now(), timestamp: new Date(timestamp).toLocaleTimeString(), message },
        ...prev,
      ]);
    });

    eventSourceRef.current = es;
  }

  useEffect(() => {
    fetchQr();
    connectEvents();
    return () => eventSourceRef.current?.close();
  }, []);

  async function handleRestart() {
    setRestarting(true);
    setScanEntries([]);
    try {
      const res = await fetch('/restart', { method: 'POST' });
      const data = await res.json();
      setQrData(data);
      connectEvents();
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Scanner</h1>
      </header>

      <section className="card">
        <h2>Connection QR Code</h2>
        <p className="subtext">
          To connect scanners with the server, connect the server and scanners to
          the same wifi, then scan this QR code.
        </p>
        <div className="qr-block">
          {qrData ? (
            <>
              <img src={qrData.qr} alt="Connection QR Code" className="qr-image" />
              <code className="server-url">{qrData.url}</code>
            </>
          ) : (
            <div className="qr-placeholder">Loading…</div>
          )}
        </div>
        <button
          className="btn-restart"
          onClick={handleRestart}
          disabled={restarting}
        >
          {restarting ? 'Restarting…' : 'Restart Server'}
        </button>
      </section>

      <section className="card">
        <h2>Data Log</h2>
        {logEntries.length === 0 ? (
          <p className="empty-state">No log entries yet.</p>
        ) : (
          <ul className="log-list">
            {logEntries.map((entry) => (
              <li key={entry.id} className="log-entry">
                <span className="log-time">{entry.timestamp}</span>
                <span className="log-message">{entry.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Data Received from Scanner</h2>
        {scanEntries.length === 0 ? (
          <p className="empty-state">No data received yet.</p>
        ) : (
          <ul className="scan-list">
            {scanEntries.map((entry) => (
              <ScanCard key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
