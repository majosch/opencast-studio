import { useContext } from 'react';
import { Dispatcher } from '../studio-state';
import { bug } from './err';


/**
 * Checks if we app is running on a mobile device.
 *
 * This check could be more exhaustive, but this includes all browser we
 * officially support.
 */
export const onMobileDevice = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.platform) ||
  /Android/i.test(navigator.userAgent);

/**
 * Checks if the client supports capturing the device's display (or individual
 * windows).
 *
 * Detecting whether display capture is supported is hard. There is currently
 * no proper solution. See these two links for more information:
 * - https://stackoverflow.com/q/58842831/2408867
 * - https://github.com/w3c/mediacapture-screen-share/issues/127
 *
 * To work around this problem, we simply check if the browser runs on a
 * mobile device. Currently, no mobile device/browser supports display
 * capture. However, this will probably change in the future, so we have to
 * revisit this issue again. This is tracked in this issue:
 * https://github.com/elan-ev/opencast-studio/issues/204
 */
export const isDisplayCaptureSupported = () =>
  'mediaDevices' in navigator &&
  'getDisplayMedia' in navigator.mediaDevices &&
  !onMobileDevice();

/**
 * Checks if the client supports capturing "user devices" (usually webcams or
 * phone cameras).
 */
export const isUserCaptureSupported = () =>
  'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

/**
 * Checks if the browsers supports the `MediaRecorder` API required to actually
 * record the media streams.
 */
export const isRecordingSupported = () => typeof MediaRecorder !== 'undefined';

/**
 * Checks if this runs in Safari. Check from https://stackoverflow.com/a/23522755/
 */
export const onSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/**
 * Returns the dimensions as [w, h] array or `null` if there is no video track.
 */
export const dimensionsOf = (stream: MediaStream | null): [number, number] | null => {
  const { width, height } = stream?.getVideoTracks()?.[0]?.getSettings() ?? {};
  return width == null || height == null ? null : [width, height];
};

/** Converts the MIME type into a file extension. */
export const mimeToExt = (mime: string) => {
  if (mime) {
    const lowerMime = mime.toLowerCase();
    if (lowerMime.startsWith('video/webm')) {
      return 'webm';
    }
    if (lowerMime.startsWith('video/mp4')) {
      return 'mp4';
    }
    if (lowerMime.startsWith('video/x-matroska')) {
      return 'mkv';
    }
    if (lowerMime.startsWith('video/avi')) {
      return 'avi';
    }
    if (lowerMime.startsWith('video/quicktime')) {
      return 'mov';
    }
  }

  // If we know nothing, our best guess is webm; except for Safari which does
  // not understand webm: there it's mp4.
  return onSafari() ? 'mp4' : 'webm';
};

/**
 * Returns a suitable filename for a recording with the MIME type `mime` and the
 * given `flavor`. The latter should be either `presenter` or `presentation`.
 * `mime` can be null or a string and is converted to a file extension on a best
 * effort basis.
 */
export const recordingFileName = ({ mime, flavor, title, presenter }: {
  mime: string,
  flavor: string,
  title: string,
  presenter: string,
}) => {
  const titlePart = (title ? ` - ${title}` : '').substring(0, 50);
  const presenterPart = (presenter ? ` - ${presenter}` : '').substring(0, 50);
  return `${nowAsString()}${titlePart}${presenterPart} (${flavor}, OC Studio).${mimeToExt(mime)}`;
};

const nowAsString = () => {
  const pad2 = (n: number) => (n >= 10 ? '' : '0') + n;

  const now = new Date();
  return ''
    + now.getFullYear() + '-'
    + pad2(now.getMonth() + 1) + '-'
    + pad2(now.getDate()) + ' '
    + pad2(now.getHours()) + '-'
    + pad2(now.getMinutes());
};

export const userHasWebcam = async() => {
  if (!('mediaDevices' in navigator)) {
    return false;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.some(d => d.kind === 'videoinput');
};

/**
 * Decodes the given hex string into a new string. If the given string contains
 * characters that are not hexadecimal digits or if the string's length is odd,
 * this function will throw an exception.
 */
export const decodeHexString = (hex: string): string => {
  if (hex.length % 2 !== 0) {
    throw new SyntaxError('hex string does not have an even length');
  }

  const digitToNum = (digit: string) => {
    if (digit >= '0' && digit <= '9') {
      return digit.charCodeAt(0) - '0'.charCodeAt(0);
    } else if (digit >= 'a' && digit <= 'f') {
      return digit.charCodeAt(0) - 'a'.charCodeAt(0) + 10;
    } else if (digit >= 'A' && digit <= 'F') {
      return digit.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
    } else {
      throw new RangeError(`invalid hex digit '${digit}'`);
    }
  };

  let bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = 16 * digitToNum(hex.substring(i, i + 1))
      + digitToNum(hex.substring(i + 1, i + 2));
  }

  return new TextDecoder().decode(bytes);
};

/** Returns a promise that resolves after `ms` milliseconds. */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Obtains all media devices and stores them into the global state. */
export const queryMediaDevices = async(dispatch: Dispatcher) => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  dispatch({ type: 'UPDATE_MEDIA_DEVICES', devices });
};

/**
 * Filters the `allDevices` array such that only devices with the given `kind`
 * are included and no two devices have the same `deviceId`.
 */
export const getUniqueDevices = (
  allDevices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
): MediaDeviceInfo[] => {
  let out: MediaDeviceInfo[] = [];
  for (const d of allDevices) {
    // Only interested in one kind of device.
    if (d.kind !== kind) {
      continue;
    }

    // If we already have a device with that device ID, we ignore it.
    if (out.some(od => od.deviceId === d.deviceId)) {
      continue;
    }

    out.push(d);
  }

  return out;
};

/** Like `useContext` but throws an error if the context is `null`. */
export const usePresentContext = <T, >(context: React.Context<T | null>, hookName: string): T => {
  return useContext(context)
    ?? bug(`hook '${hookName}' called without parent context provider`);
};
