export const utils = {
  isString(value) {
    return (
      typeof value === "string" ||
      Object.prototype.toString.call(value) === "[object String]"
    );
  },
  Blob:
    window.Blob ||
    window.BlobBuilder ||
    window.WebKitBlobBuilder ||
    window.MozBlobBuilder ||
    window.MSBlobBuilder,
  URL: window.URL || window.webkitURL || window.mozURL || window.msURL,
  createWebWorker: function createWebWorker(content) {
    if (!this.isString(content)) {
      return {};
    }

    try {
      const blob = new this.Blob([content], {
        type: "text/javascript"
      });
      const objectUrl = this.URL.createObjectURL(blob);
      const worker = new Worker(objectUrl);

      return {
        objectUrl,
        worker
      };
    } catch (e) {
      return "" + e;
    }
  }
};

export const getFrameIndex = (
  frames,
  timestamp,
  start = 0,
  end = frames.length - 1
) => {
  const gap = end - start;

  if (gap === 0) {
    return start;
  } else if (gap === 1) {
    return timestamp < frames[end].timestamp ? start : end;
  }

  const mid = Math.floor((end + start) / 2);
  const midTimestamp = frames[mid].timestamp;

  if (timestamp === midTimestamp) {
    return mid;
  }
  return timestamp < midTimestamp
    ? getFrameIndex(frames, timestamp, start, mid)
    : getFrameIndex(frames, timestamp, mid, end);
};
export const timediff = millis => {
  const abs = Math.floor(millis / 1000);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  const s = `${secs < 10 ? "0" : ""}${secs}`;
  const m = mins > 0 ? `${mins < 10 ? "0" : ""}${mins}` : "00";
  return `${m}:${s}`;
};
