import * as faceapi from 'face-api.js';

let modelsLoaded = false;

// Loads the "trained brain" files from public/models. Only needs to run once.
export async function loadFaceModels() {
  if (modelsLoaded) return;
  const MODEL_URL = '/models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  modelsLoaded = true;
}

// A citizenship/ID photo often shows the whole card or document, with the
// person's face taking up only a small part of the frame - unlike a live
// selfie, where the face fills most of the shot. The detector's default
// settings are tuned for that selfie case and can miss a small face. We try
// a few passes, each more sensitive (bigger input size = notices smaller
// faces, lower score threshold = more lenient about what counts as a face),
// stopping at the first one that finds something.
const DETECTOR_ATTEMPTS = [
  { inputSize: 416, scoreThreshold: 0.5 },
  { inputSize: 608, scoreThreshold: 0.35 },
  { inputSize: 800, scoreThreshold: 0.25 },
];

// Takes an <img> or <video> element, finds the face, and returns its
// "fingerprint" (128 numbers). Returns null if no face was found.
export async function getFaceDescriptor(imageOrVideoElement) {
  for (const { inputSize, scoreThreshold } of DETECTOR_ATTEMPTS) {
    const detection = await faceapi
      .detectSingleFace(imageOrVideoElement, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (detection) return Array.from(detection.descriptor);
  }
  return null;
}

// Compares two fingerprints. Returns a distance: lower = more similar.
// Under ~0.6 is generally considered a match for face-api.js.
export function compareDescriptors(descriptorA, descriptorB) {
  if (!descriptorA || !descriptorB) return Infinity;
  const dA = new Float32Array(descriptorA);
  const dB = new Float32Array(descriptorB);
  return faceapi.euclideanDistance(dA, dB);
}

// Helper: loads a base64 data URL (like your citizenshipDoc) into an
// actual <img> element so face-api.js can read it.
export function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load that image'));
    img.src = dataUrl;
  });
}